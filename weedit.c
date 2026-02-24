// weedit.c — a minimal terminal text editor in C (kilo-inspired)
// Features: raw mode input, file I/O, insert/delete, scrolling, status bar,
// search, and C syntax highlighting (keywords/strings/comments/numbers).
//
// Build: cc -std=c11 -O2 -Wall -Wextra -pedantic -o weedit weedit.c
// Run:   ./weedit [filename]
//
// Notes:
// - ANSI escape codes are used for rendering; run in a modern terminal.
// - On Windows, use WSL for best results.

#define _DEFAULT_SOURCE
#define _BSD_SOURCE
#define _GNU_SOURCE

#include <ctype.h>
#include <errno.h>
#include <fcntl.h>
#include <stdarg.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <termios.h>
#include <time.h>
#include <unistd.h>

#ifndef CTRL_KEY
#define CTRL_KEY(k) ((k) & 0x1f)
#endif

enum editorKey {
  BACKSPACE = 127,
  ARROW_LEFT = 1000,
  ARROW_RIGHT,
  ARROW_UP,
  ARROW_DOWN,
  DEL_KEY,
  HOME_KEY,
  END_KEY,
  PAGE_UP,
  PAGE_DOWN
};

enum editorHighlight {
  HL_NORMAL = 0,
  HL_COMMENT,
  HL_MLCOMMENT,
  HL_KEYWORD1,
  HL_KEYWORD2,
  HL_STRING,
  HL_NUMBER,
  HL_MATCH
};

#define TAB_STOP 4
#define QUIT_TIMES 3

typedef struct erow {
  int idx;              // Row index in file
  int size;             // Size of chars
  int rsize;            // Size of render
  char *chars;          // Raw chars
  char *render;         // Rendered chars (tabs expanded)
  unsigned char *hl;    // Highlight types per render char
  int hl_open_comment;  // Is multi-line comment open from previous line?
} erow;

struct editorConfig {
  int cx, cy;      // Cursor x/y in chars coordinates
  int rx;          // Render x (tabs expanded)
  int rowoff;      // Vertical scroll
  int coloff;      // Horizontal scroll
  int screenrows;  // Screen rows for text area
  int screencols;  // Screen cols
  int numrows;
  erow *row;
  int dirty;
  char *filename;
  char statusmsg[240];
  time_t statusmsg_time;
  struct termios orig_termios;

  // Syntax
  char **keywords;
  int hl_flags;
} E;

enum editorHighlightFlags {
  HL_HIGHLIGHT_NUMBERS = 1 << 0,
  HL_HIGHLIGHT_STRINGS = 1 << 1
};

static char *C_HL_keywords[] = {
  // keyword1
  "switch", "if", "while", "for", "break", "continue", "return", "else",
  "struct", "union", "typedef", "static", "enum", "class",
  "case", "default", "do", "goto",
  // keyword2 (types)
  "int|", "long|", "double|", "float|", "char|", "unsigned|", "signed|",
  "void|", "short|", "size_t|", "ssize_t|", "const|", "volatile|",
  "bool|", "_Bool|",
  NULL
};

static const char *C_HL_extensions[] = { ".c", ".h", ".cpp", ".hpp", NULL };

static void die(const char *s) {
  write(STDOUT_FILENO, "\x1b[2J", 4);
  write(STDOUT_FILENO, "\x1b[H", 3);

  perror(s);
  exit(1);
}

static void disableRawMode(void) {
  if (tcsetattr(STDIN_FILENO, TCSAFLUSH, &E.orig_termios) == -1) {
    // If this fails, not much we can do safely.
  }
}

static void enableRawMode(void) {
  if (tcgetattr(STDIN_FILENO, &E.orig_termios) == -1) die("tcgetattr");
  atexit(disableRawMode);

  struct termios raw = E.orig_termios;
  raw.c_iflag &= ~(BRKINT | ICRNL | INPCK | ISTRIP | IXON);
  raw.c_oflag &= ~(OPOST);
  raw.c_cflag |= (CS8);
  raw.c_lflag &= ~(ECHO | ICANON | IEXTEN | ISIG);
  raw.c_cc[VMIN] = 0;
  raw.c_cc[VTIME] = 1;

  if (tcsetattr(STDIN_FILENO, TCSAFLUSH, &raw) == -1) die("tcsetattr");
}

static int editorReadKey(void) {
  int nread;
  char c;
  while ((nread = (int)read(STDIN_FILENO, &c, 1)) != 1) {
    if (nread == -1 && errno != EAGAIN) die("read");
  }

  if (c == '\x1b') {
    char seq[3];
    if (read(STDIN_FILENO, &seq[0], 1) != 1) return '\x1b';
    if (read(STDIN_FILENO, &seq[1], 1) != 1) return '\x1b';

    if (seq[0] == '[') {
      if (seq[1] >= '0' && seq[1] <= '9') {
        if (read(STDIN_FILENO, &seq[2], 1) != 1) return '\x1b';
        if (seq[2] == '~') {
          switch (seq[1]) {
            case '1': return HOME_KEY;
            case '3': return DEL_KEY;
            case '4': return END_KEY;
            case '5': return PAGE_UP;
            case '6': return PAGE_DOWN;
            case '7': return HOME_KEY;
            case '8': return END_KEY;
          }
        }
      } else {
        switch (seq[1]) {
          case 'A': return ARROW_UP;
          case 'B': return ARROW_DOWN;
          case 'C': return ARROW_RIGHT;
          case 'D': return ARROW_LEFT;
          case 'H': return HOME_KEY;
          case 'F': return END_KEY;
        }
      }
    } else if (seq[0] == 'O') {
      switch (seq[1]) {
        case 'H': return HOME_KEY;
        case 'F': return END_KEY;
      }
    }

    return '\x1b';
  }

  return c;
}

static int getCursorPosition(int *rows, int *cols) {
  char buf[32];
  unsigned int i = 0;

  if (write(STDOUT_FILENO, "\x1b[6n", 4) != 4) return -1;

  while (i < sizeof(buf) - 1) {
    if (read(STDIN_FILENO, &buf[i], 1) != 1) break;
    if (buf[i] == 'R') break;
    i++;
  }
  buf[i] = '\0';

  if (buf[0] != '\x1b' || buf[1] != '[') return -1;
  if (sscanf(&buf[2], "%d;%d", rows, cols) != 2) return -1;

  return 0;
}

static int getWindowSize(int *rows, int *cols) {
  struct winsize ws;
  if (ioctl(STDOUT_FILENO, TIOCGWINSZ, &ws) == -1 || ws.ws_col == 0) {
    // fallback
    if (write(STDOUT_FILENO, "\x1b[999C\x1b[999B", 12) != 12) return -1;
    return getCursorPosition(rows, cols);
  } else {
    *cols = ws.ws_col;
    *rows = ws.ws_row;
    return 0;
  }
}

struct abuf {
  char *b;
  int len;
};

#define ABUF_INIT {NULL, 0}

static void abAppend(struct abuf *ab, const char *s, int len) {
  char *newbuf = realloc(ab->b, (size_t)ab->len + (size_t)len);
  if (!newbuf) return;
  memcpy(&newbuf[ab->len], s, (size_t)len);
  ab->b = newbuf;
  ab->len += len;
}

static void abFree(struct abuf *ab) {
  free(ab->b);
}

static int is_separator(int c) {
  return isspace(c) || c == '\0' || strchr(",.()+-/*=~%<>[];{}", c) != NULL;
}

static void editorUpdateSyntax(erow *row);

static int editorRowCxToRx(const erow *row, int cx) {
  int rx = 0;
  for (int j = 0; j < cx; j++) {
    if (row->chars[j] == '\t') {
      rx += (TAB_STOP - 1) - (rx % TAB_STOP);
    }
    rx++;
  }
  return rx;
}

static int editorRowRxToCx(const erow *row, int rx) {
  int cur_rx = 0;
  int cx;
  for (cx = 0; cx < row->size; cx++) {
    if (row->chars[cx] == '\t') {
      cur_rx += (TAB_STOP - 1) - (cur_rx % TAB_STOP);
    }
    cur_rx++;
    if (cur_rx > rx) return cx;
  }
  return cx;
}

static void editorRowRender(erow *row) {
  int tabs = 0;
  for (int j = 0; j < row->size; j++) {
    if (row->chars[j] == '\t') tabs++;
  }

  free(row->render);
  row->render = malloc((size_t)row->size + (size_t)tabs * (TAB_STOP - 1) + 1);
  if (!row->render) die("malloc");

  int idx = 0;
  for (int j = 0; j < row->size; j++) {
    if (row->chars[j] == '\t') {
      row->render[idx++] = ' ';
      while (idx % TAB_STOP != 0) row->render[idx++] = ' ';
    } else {
      row->render[idx++] = row->chars[j];
    }
  }
  row->render[idx] = '\0';
  row->rsize = idx;

  free(row->hl);
  row->hl = malloc((size_t)row->rsize);
  if (!row->hl) die("malloc");

  editorUpdateSyntax(row);
}

static void editorInsertRow(int at, const char *s, size_t len) {
  if (at < 0 || at > E.numrows) return;
  E.row = realloc(E.row, sizeof(erow) * (size_t)(E.numrows + 1));
  if (!E.row) die("realloc");
  memmove(&E.row[at + 1], &E.row[at], sizeof(erow) * (size_t)(E.numrows - at));

  for (int j = at + 1; j <= E.numrows; j++) {
    E.row[j].idx++;
  }

  E.row[at].idx = at;
  E.row[at].size = (int)len;
  E.row[at].chars = malloc(len + 1);
  if (!E.row[at].chars) die("malloc");
  memcpy(E.row[at].chars, s, len);
  E.row[at].chars[len] = '\0';

  E.row[at].rsize = 0;
  E.row[at].render = NULL;
  E.row[at].hl = NULL;
  E.row[at].hl_open_comment = 0;

  editorRowRender(&E.row[at]);

  E.numrows++;
  E.dirty++;
}

static void editorFreeRow(erow *row) {
  free(row->render);
  free(row->chars);
  free(row->hl);
}

static void editorDelRow(int at) {
  if (at < 0 || at >= E.numrows) return;
  editorFreeRow(&E.row[at]);
  memmove(&E.row[at], &E.row[at + 1], sizeof(erow) * (size_t)(E.numrows - at - 1));
  for (int j = at; j < E.numrows - 1; j++) E.row[j].idx--;
  E.numrows--;
  E.dirty++;
}

static void editorRowInsertChar(erow *row, int at, int c) {
  if (at < 0 || at > row->size) at = row->size;
  row->chars = realloc(row->chars, (size_t)row->size + 2);
  if (!row->chars) die("realloc");
  memmove(&row->chars[at + 1], &row->chars[at], (size_t)(row->size - at + 1));
  row->size++;
  row->chars[at] = (char)c;
  editorRowRender(row);
  E.dirty++;
}

static void editorRowAppendString(erow *row, const char *s, size_t len) {
  row->chars = realloc(row->chars, (size_t)row->size + len + 1);
  if (!row->chars) die("realloc");
  memcpy(&row->chars[row->size], s, len);
  row->size += (int)len;
  row->chars[row->size] = '\0';
  editorRowRender(row);
  E.dirty++;
}

static void editorRowDelChar(erow *row, int at) {
  if (at < 0 || at >= row->size) return;
  memmove(&row->chars[at], &row->chars[at + 1], (size_t)(row->size - at));
  row->size--;
  editorRowRender(row);
  E.dirty++;
}

static void editorSelectSyntaxHighlight(void) {
  E.keywords = NULL;
  E.hl_flags = 0;
  if (!E.filename) return;

  const char *ext = strrchr(E.filename, '.');
  if (!ext) return;

  for (int i = 0; C_HL_extensions[i]; i++) {
    if (strcmp(ext, C_HL_extensions[i]) == 0) {
      E.keywords = C_HL_keywords;
      E.hl_flags = HL_HIGHLIGHT_NUMBERS | HL_HIGHLIGHT_STRINGS;
      return;
    }
  }
}

static void editorUpdateSyntax(erow *row) {
  if (!E.keywords) {
    memset(row->hl, HL_NORMAL, (size_t)row->rsize);
    row->hl_open_comment = 0;
    return;
  }

  memset(row->hl, HL_NORMAL, (size_t)row->rsize);

  const char *scs = "//";
  const char *mcs = "/*";
  const char *mce = "*/";

  int prev_sep = 1;
  int in_string = 0; // 0 none, otherwise quote char
  int in_comment = row->hl_open_comment;

  int i = 0;
  while (i < row->rsize) {
    char c = row->render[i];
    unsigned char prev_hl = (i > 0) ? row->hl[i - 1] : HL_NORMAL;

    // Single-line comment
    if (!in_string && !in_comment) {
      if (!strncmp(&row->render[i], scs, 2)) {
        memset(&row->hl[i], HL_COMMENT, (size_t)(row->rsize - i));
        break;
      }
    }

    // Multi-line comment
    if (!in_string) {
      if (in_comment) {
        row->hl[i] = HL_MLCOMMENT;
        if (!strncmp(&row->render[i], mce, 2)) {
          row->hl[i] = HL_MLCOMMENT;
          if (i + 1 < row->rsize) row->hl[i + 1] = HL_MLCOMMENT;
          i += 2;
          in_comment = 0;
          prev_sep = 1;
          continue;
        } else {
          i++;
          continue;
        }
      } else if (!strncmp(&row->render[i], mcs, 2)) {
        row->hl[i] = HL_MLCOMMENT;
        if (i + 1 < row->rsize) row->hl[i + 1] = HL_MLCOMMENT;
        i += 2;
        in_comment = 1;
        continue;
      }
    }

    // Strings
    if (E.hl_flags & HL_HIGHLIGHT_STRINGS) {
      if (in_string) {
        row->hl[i] = HL_STRING;
        if (c == '\\' && i + 1 < row->rsize) {
          row->hl[i + 1] = HL_STRING;
          i += 2;
          continue;
        }
        if (c == in_string) in_string = 0;
        i++;
        prev_sep = 1;
        continue;
      } else {
        if (c == '"' || c == '\'') {
          in_string = c;
          row->hl[i] = HL_STRING;
          i++;
          continue;
        }
      }
    }

    // Numbers
    if (E.hl_flags & HL_HIGHLIGHT_NUMBERS) {
      if ((isdigit((unsigned char)c) && (prev_sep || prev_hl == HL_NUMBER)) ||
          (c == '.' && prev_hl == HL_NUMBER)) {
        row->hl[i] = HL_NUMBER;
        i++;
        prev_sep = 0;
        continue;
      }
    }

    // Keywords
    if (prev_sep) {
      for (int j = 0; E.keywords[j]; j++) {
        int klen = (int)strlen(E.keywords[j]);
        int kw2 = E.keywords[j][klen - 1] == '|';
        if (kw2) klen--;

        if (!strncmp(&row->render[i], E.keywords[j], (size_t)klen) &&
            is_separator(row->render[i + klen])) {
          memset(&row->hl[i], (unsigned char)(kw2 ? HL_KEYWORD2 : HL_KEYWORD1), (size_t)klen);
          i += klen;
          break;
        }
      }
      if (E.keywords && E.keywords[0]) {
        // If we advanced due to keyword match, continue.
        if (i < row->rsize && (row->hl[i - 1] == HL_KEYWORD1 || row->hl[i - 1] == HL_KEYWORD2)) {
          prev_sep = 0;
          continue;
        }
      }
    }

    prev_sep = is_separator((unsigned char)c);
    i++;
  }

  int changed = (row->hl_open_comment != in_comment);
  row->hl_open_comment = in_comment;
  if (changed && row->idx + 1 < E.numrows) {
    editorUpdateSyntax(&E.row[row->idx + 1]);
  }
}

static int editorSyntaxToColor(int hl) {
  switch (hl) {
    case HL_COMMENT:
    case HL_MLCOMMENT: return 36; // cyan
    case HL_KEYWORD1:  return 33; // yellow
    case HL_KEYWORD2:  return 32; // green
    case HL_STRING:    return 35; // magenta
    case HL_NUMBER:    return 31; // red
    case HL_MATCH:     return 34; // blue
    default:           return 37; // white/gray
  }
}

static void editorSetStatusMessage(const char *fmt, ...) {
  va_list ap;
  va_start(ap, fmt);
  vsnprintf(E.statusmsg, sizeof(E.statusmsg), fmt, ap);
  va_end(ap);
  E.statusmsg_time = time(NULL);
}

static char *editorRowsToString(int *buflen) {
  int totlen = 0;
  for (int j = 0; j < E.numrows; j++) totlen += E.row[j].size + 1;
  *buflen = totlen;

  char *buf = malloc((size_t)totlen);
  if (!buf) die("malloc");

  char *p = buf;
  for (int j = 0; j < E.numrows; j++) {
    memcpy(p, E.row[j].chars, (size_t)E.row[j].size);
    p += E.row[j].size;
    *p = '\n';
    p++;
  }

  return buf;
}

static void editorOpen(const char *filename) {
  free(E.filename);
  E.filename = strdup(filename);
  if (!E.filename) die("strdup");

  editorSelectSyntaxHighlight();

  FILE *fp = fopen(filename, "r");
  if (!fp) {
    editorSetStatusMessage("New file: %s (couldn't open, will create on save)", filename);
    return;
  }

  char *line = NULL;
  size_t linecap = 0;
  ssize_t linelen;
  while ((linelen = getline(&line, &linecap, fp)) != -1) {
    while (linelen > 0 && (line[linelen - 1] == '\n' || line[linelen - 1] == '\r')) {
      linelen--;
    }
    editorInsertRow(E.numrows, line, (size_t)linelen);
  }
  free(line);
  fclose(fp);
  E.dirty = 0;
}

static void editorSave(void) {
  if (E.filename == NULL) {
    editorSetStatusMessage("Save failed: no filename. Quit and reopen with a name.");
    return;
  }

  int len;
  char *buf = editorRowsToString(&len);

  int fd = open(E.filename, O_RDWR | O_CREAT, 0644);
  if (fd != -1) {
    if (ftruncate(fd, len) != -1) {
      if (write(fd, buf, (size_t)len) == len) {
        close(fd);
        free(buf);
        E.dirty = 0;
        editorSetStatusMessage("Saved %d bytes to %s", len, E.filename);
        return;
      }
    }
    close(fd);
  }

  free(buf);
  editorSetStatusMessage("Save failed: %s", strerror(errno));
}

static void editorInsertChar(int c) {
  if (E.cy == E.numrows) {
    editorInsertRow(E.numrows, "", 0);
  }
  editorRowInsertChar(&E.row[E.cy], E.cx, c);
  E.cx++;
}

static void editorInsertNewline(void) {
  if (E.cx == 0) {
    editorInsertRow(E.cy, "", 0);
  } else {
    erow *row = &E.row[E.cy];
    editorInsertRow(E.cy + 1, &row->chars[E.cx], (size_t)(row->size - E.cx));
    row = &E.row[E.cy];
    row->size = E.cx;
    row->chars[row->size] = '\0';
    editorRowRender(row);
  }
  E.cy++;
  E.cx = 0;
}

static void editorDelChar(void) {
  if (E.cy == E.numrows) return;
  if (E.cx == 0 && E.cy == 0) return;

  erow *row = &E.row[E.cy];
  if (E.cx > 0) {
    editorRowDelChar(row, E.cx - 1);
    E.cx--;
  } else {
    E.cx = E.row[E.cy - 1].size;
    editorRowAppendString(&E.row[E.cy - 1], row->chars, (size_t)row->size);
    editorDelRow(E.cy);
    E.cy--;
  }
}

static void editorScroll(void) {
  E.rx = 0;
  if (E.cy < E.numrows) {
    E.rx = editorRowCxToRx(&E.row[E.cy], E.cx);
  }

  if (E.cy < E.rowoff) E.rowoff = E.cy;
  if (E.cy >= E.rowoff + E.screenrows) E.rowoff = E.cy - E.screenrows + 1;

  if (E.rx < E.coloff) E.coloff = E.rx;
  if (E.rx >= E.coloff + E.screencols) E.coloff = E.rx - E.screencols + 1;
}

static void editorDrawRows(struct abuf *ab) {
  for (int y = 0; y < E.screenrows; y++) {
    int filerow = y + E.rowoff;
    if (filerow >= E.numrows) {
      if (E.numrows == 0 && y == E.screenrows / 3) {
        char welcome[80];
        int welcomelen = snprintf(welcome, sizeof(welcome),
          "WEEdit — Ctrl-S save | Ctrl-F find | Ctrl-Space autocomplete | Ctrl-Q quit");
        if (welcomelen > E.screencols) welcomelen = E.screencols;
        int padding = (E.screencols - welcomelen) / 2;
        if (padding) {
          abAppend(ab, "~", 1);
          padding--;
        }
        while (padding--) abAppend(ab, " ", 1);
        abAppend(ab, welcome, welcomelen);
      } else {
        abAppend(ab, "~", 1);
      }
    } else {
      erow *row = &E.row[filerow];
      int len = row->rsize - E.coloff;
      if (len < 0) len = 0;
      if (len > E.screencols) len = E.screencols;

      char *c = &row->render[E.coloff];
      unsigned char *hl = &row->hl[E.coloff];
      int current_color = -1;

      for (int j = 0; j < len; j++) {
        if (hl[j] == HL_NORMAL) {
          if (current_color != -1) {
            abAppend(ab, "\x1b[39m", 5);
            current_color = -1;
          }
          abAppend(ab, &c[j], 1);
        } else {
          int color = editorSyntaxToColor(hl[j]);
          if (color != current_color) {
            current_color = color;
            char buf[16];
            int clen = snprintf(buf, sizeof(buf), "\x1b[%dm", color);
            abAppend(ab, buf, clen);
          }
          abAppend(ab, &c[j], 1);
        }
      }
      if (current_color != -1) abAppend(ab, "\x1b[39m", 5);
    }

    abAppend(ab, "\x1b[K", 3);
    abAppend(ab, "\r\n", 2);
  }
}

static void editorDrawStatusBar(struct abuf *ab) {
  abAppend(ab, "\x1b[7m", 4); // inverted
  char status[80], rstatus[80];

  int len = snprintf(status, sizeof(status), "%.20s - %d lines %s",
    E.filename ? E.filename : "[No Name]",
    E.numrows,
    E.dirty ? "(modified)" : "");

  int rlen = snprintf(rstatus, sizeof(rstatus), "Ln %d, Col %d",
    E.cy + 1, E.cx + 1);

  if (len > E.screencols) len = E.screencols;
  abAppend(ab, status, len);

  while (len < E.screencols) {
    if (E.screencols - len == rlen) {
      abAppend(ab, rstatus, rlen);
      break;
    } else {
      abAppend(ab, " ", 1);
      len++;
    }
  }

  abAppend(ab, "\x1b[m", 3);
  abAppend(ab, "\r\n", 2);
}

static void editorDrawMessageBar(struct abuf *ab) {
  abAppend(ab, "\x1b[K", 3);
  int msglen = (int)strlen(E.statusmsg);
  if (msglen > E.screencols) msglen = E.screencols;
  if (msglen && time(NULL) - E.statusmsg_time < 10) {
    abAppend(ab, E.statusmsg, msglen);
  }
}

static void editorRefreshScreen(void) {
  editorScroll();

  struct abuf ab = ABUF_INIT;

  abAppend(&ab, "\x1b[?25l", 6); // hide cursor
  abAppend(&ab, "\x1b[H", 3);    // go home

  editorDrawRows(&ab);
  editorDrawStatusBar(&ab);
  editorDrawMessageBar(&ab);

  char buf[32];
  int cx = 1;
  int cy = 1;
  if (E.cy < E.numrows) {
    cx = (E.rx - E.coloff) + 1;
    cy = (E.cy - E.rowoff) + 1;
  }
  snprintf(buf, sizeof(buf), "\x1b[%d;%dH", cy, cx);
  abAppend(&ab, buf, (int)strlen(buf));

  abAppend(&ab, "\x1b[?25h", 6); // show cursor

  write(STDOUT_FILENO, ab.b, (size_t)ab.len);
  abFree(&ab);
}

static char *editorPrompt(const char *prompt, void (*callback)(char *, int)) {
  size_t bufsize = 128;
  char *buf = malloc(bufsize);
  if (!buf) die("malloc");

  size_t buflen = 0;
  buf[0] = '\0';

  while (1) {
    editorSetStatusMessage(prompt, buf);
    editorRefreshScreen();

    int c = editorReadKey();
    if (c == DEL_KEY || c == CTRL_KEY('h') || c == BACKSPACE) {
      if (buflen != 0) buf[--buflen] = '\0';
    } else if (c == '\x1b') {
      editorSetStatusMessage("");
      if (callback) callback(buf, c);
      free(buf);
      return NULL;
    } else if (c == '\r') {
      if (buflen != 0) {
        editorSetStatusMessage("");
        if (callback) callback(buf, c);
        return buf;
      }
    } else if (!iscntrl(c) && c < 128) {
      if (buflen + 1 >= bufsize) {
        bufsize *= 2;
        buf = realloc(buf, bufsize);
        if (!buf) die("realloc");
      }
      buf[buflen++] = (char)c;
      buf[buflen] = '\0';
    }

    if (callback) callback(buf, c);
  }
}

static void editorFindCallback(char *query, int key) {
  static int last_match = -1;
  static int direction = 1;

  static int saved_hl_line;
  static unsigned char *saved_hl = NULL;

  if (saved_hl) {
    memcpy(E.row[saved_hl_line].hl, saved_hl, (size_t)E.row[saved_hl_line].rsize);
    free(saved_hl);
    saved_hl = NULL;
  }

  if (key == '\r' || key == '\x1b') {
    last_match = -1;
    direction = 1;
    return;
  } else if (key == ARROW_RIGHT || key == ARROW_DOWN) {
    direction = 1;
  } else if (key == ARROW_LEFT || key == ARROW_UP) {
    direction = -1;
  } else {
    last_match = -1;
    direction = 1;
  }

  if (last_match == -1) direction = 1;
  int current = last_match;
  for (int i = 0; i < E.numrows; i++) {
    current += direction;
    if (current == -1) current = E.numrows - 1;
    else if (current == E.numrows) current = 0;

    erow *row = &E.row[current];
    char *match = strstr(row->render, query);
    if (match) {
      last_match = current;
      E.cy = current;
      E.cx = editorRowRxToCx(row, (int)(match - row->render));
      E.rowoff = E.numrows; // force scroll to put match on screen

      saved_hl_line = current;
      saved_hl = malloc((size_t)row->rsize);
      if (!saved_hl) die("malloc");
      memcpy(saved_hl, row->hl, (size_t)row->rsize);

      memset(&row->hl[match - row->render], HL_MATCH, strlen(query));
      break;
    }
  }
}

static void editorFind(void) {
  int saved_cx = E.cx;
  int saved_cy = E.cy;
  int saved_coloff = E.coloff;
  int saved_rowoff = E.rowoff;

  char *query = editorPrompt("Search: %s (ESC to cancel, Enter to accept, Arrows to navigate)",
                             editorFindCallback);
  if (query) {
    free(query);
  } else {
    E.cx = saved_cx;
    E.cy = saved_cy;
    E.coloff = saved_coloff;
    E.rowoff = saved_rowoff;
  }
}

static void editorMoveCursor(int key) {
  erow *row = (E.cy >= E.numrows) ? NULL : &E.row[E.cy];

  switch (key) {
    case ARROW_LEFT:
      if (E.cx != 0) {
        E.cx--;
      } else if (E.cy > 0) {
        E.cy--;
        E.cx = E.row[E.cy].size;
      }
      break;
    case ARROW_RIGHT:
      if (row && E.cx < row->size) {
        E.cx++;
      } else if (row && E.cx == row->size) {
        E.cy++;
        E.cx = 0;
      }
      break;
    case ARROW_UP:
      if (E.cy != 0) E.cy--;
      break;
    case ARROW_DOWN:
      if (E.cy < E.numrows) E.cy++;
      break;
  }

  row = (E.cy >= E.numrows) ? NULL : &E.row[E.cy];
  int rowlen = row ? row->size : 0;
  if (E.cx > rowlen) E.cx = rowlen;
}

typedef struct {
  char **items;
  int count;
  int cap;
} StrList;

static void slInit(StrList *sl) {
  sl->items = NULL;
  sl->count = 0;
  sl->cap = 0;
}

static void slFree(StrList *sl) {
  for (int i = 0; i < sl->count; i++) free(sl->items[i]);
  free(sl->items);
  sl->items = NULL;
  sl->count = 0;
  sl->cap = 0;
}

static bool slContains(const StrList *sl, const char *s) {
  for (int i = 0; i < sl->count; i++) {
    if (strcmp(sl->items[i], s) == 0) return true;
  }
  return false;
}

static void slPushUnique(StrList *sl, const char *s) {
  if (!s || !*s) return;
  if (slContains(sl, s)) return;
  if (sl->count == sl->cap) {
    sl->cap = sl->cap ? sl->cap * 2 : 32;
    sl->items = realloc(sl->items, sizeof(char *) * (size_t)sl->cap);
    if (!sl->items) die("realloc");
  }
  sl->items[sl->count++] = strdup(s);
  if (!sl->items[sl->count - 1]) die("strdup");
}

static int cmpStrPtr(const void *a, const void *b) {
  const char *sa = *(const char *const *)a;
  const char *sb = *(const char *const *)b;
  return strcmp(sa, sb);
}

static bool is_ident_start(int c) {
  return isalpha(c) || c == '_';
}

static bool is_ident_char(int c) {
  return isalnum(c) || c == '_';
}

static void editorGetCurrentIdentPrefix(char *out, size_t outcap, int *start_cx) {
  out[0] = '\0';
  *start_cx = E.cx;

  if (E.cy >= E.numrows) return;
  erow *row = &E.row[E.cy];
  if (E.cx > row->size) return;

  int i = E.cx - 1;
  while (i >= 0 && is_ident_char((unsigned char)row->chars[i])) i--;
  int start = i + 1;

  if (start < 0 || start > row->size) return;
  if (start == E.cx) return;

  int len = E.cx - start;
  if ((size_t)len >= outcap) len = (int)outcap - 1;
  memcpy(out, &row->chars[start], (size_t)len);
  out[len] = '\0';
  *start_cx = start;
}

static void editorCollectIdentifiers(StrList *all) {
  for (int r = 0; r < E.numrows; r++) {
    const char *s = E.row[r].chars;
    int n = E.row[r].size;
    int i = 0;
    while (i < n) {
      if (is_ident_start((unsigned char)s[i])) {
        int j = i + 1;
        while (j < n && is_ident_char((unsigned char)s[j])) j++;
        int len = j - i;
        if (len > 0 && len < 128) {
          char tmp[128];
          memcpy(tmp, &s[i], (size_t)len);
          tmp[len] = '\0';
          slPushUnique(all, tmp);
        }
        i = j;
      } else {
        i++;
      }
    }
  }

  for (int k = 0; C_HL_keywords[k]; k++) {
    const char *kw = C_HL_keywords[k];
    size_t len = strlen(kw);
    if (len > 0 && kw[len - 1] == '|') len--;
    if (len > 0 && len < 128) {
      char tmp[128];
      memcpy(tmp, kw, len);
      tmp[len] = '\0';
      slPushUnique(all, tmp);
    }
  }
}

static void editorBuildSuggestions(const char *prefix, StrList *all, StrList *out) {
  slInit(out);
  if (!prefix || !*prefix) return;

  size_t plen = strlen(prefix);
  for (int i = 0; i < all->count; i++) {
    const char *cand = all->items[i];
    if (strncmp(cand, prefix, plen) == 0 && strcmp(cand, prefix) != 0) {
      slPushUnique(out, cand);
    }
  }

  if (out->count > 1) qsort(out->items, (size_t)out->count, sizeof(char *), cmpStrPtr);

  if (out->count > 20) {
    for (int i = 20; i < out->count; i++) free(out->items[i]);
    out->count = 20;
  }
}

static void editorApplyCompletion(const char *prefix, const char *choice) {
  if (!choice) return;
  size_t plen = strlen(prefix);
  size_t clen = strlen(choice);
  if (clen <= plen) return;

  const char *rest = choice + plen;
  for (const char *p = rest; *p; p++) editorInsertChar((unsigned char)*p);
}

static void editorAutocomplete(void) {
  char prefix[128];
  int start_cx = E.cx;
  editorGetCurrentIdentPrefix(prefix, sizeof(prefix), &start_cx);

  if (prefix[0] == '\0') {
    editorSetStatusMessage("Autocomplete: type at least 1 identifier character first.");
    return;
  }

  StrList all;
  slInit(&all);
  editorCollectIdentifiers(&all);

  int selected = 0;

  while (1) {
    editorGetCurrentIdentPrefix(prefix, sizeof(prefix), &start_cx);

    StrList sug;
    editorBuildSuggestions(prefix, &all, &sug);

    if (selected < 0) selected = 0;
    if (selected >= sug.count) selected = sug.count - 1;
    if (sug.count <= 0) selected = 0;

    char line[220];
    if (sug.count == 0) {
      snprintf(line, sizeof(line), "AC: %s  (no matches)  [ESC cancel]", prefix);
    } else {
      int show = sug.count < 5 ? sug.count : 5;
      char picks[160];
      picks[0] = '\0';
      for (int i = 0; i < show; i++) {
        char chunk[40];
        if (i == selected) snprintf(chunk, sizeof(chunk), "[%s] ", sug.items[i]);
        else snprintf(chunk, sizeof(chunk), "%s ", sug.items[i]);
        if (strlen(picks) + strlen(chunk) + 1 < sizeof(picks)) strcat(picks, chunk);
      }
      snprintf(line, sizeof(line),
               "AC: %s  %s(↑/↓ select, Enter/Tab accept, ESC cancel)",
               prefix,
               picks);
    }
    editorSetStatusMessage("%s", line);
    editorRefreshScreen();

    int c = editorReadKey();

    if (c == '\x1b') {
      slFree(&sug);
      break;
    }

    if (c == ARROW_UP) {
      if (sug.count > 0) selected = (selected - 1 + sug.count) % sug.count;
      slFree(&sug);
      continue;
    }
    if (c == ARROW_DOWN) {
      if (sug.count > 0) selected = (selected + 1) % sug.count;
      slFree(&sug);
      continue;
    }

    if (c == '\r' || c == '\t') {
      if (sug.count > 0) {
        editorApplyCompletion(prefix, sug.items[selected]);
      }
      slFree(&sug);
      break;
    }

    if (c == BACKSPACE || c == CTRL_KEY('h')) {
      editorDelChar();
      slFree(&sug);
      continue;
    }
    if (c == DEL_KEY) {
      editorMoveCursor(ARROW_RIGHT);
      editorDelChar();
      slFree(&sug);
      continue;
    }
    if (!iscntrl(c) && c < 128) {
      editorInsertChar(c);
      slFree(&sug);
      continue;
    }
    if (c == ARROW_LEFT || c == ARROW_RIGHT) {
      editorMoveCursor(c);
      slFree(&sug);
      continue;
    }

    slFree(&sug);
  }

  slFree(&all);
  editorSetStatusMessage("");
}

static void editorProcessKeypress(void) {
  static int quit_times = QUIT_TIMES;

  int c = editorReadKey();

  switch (c) {
    case '\r':
      editorInsertNewline();
      break;

    case CTRL_KEY('q'):
      if (E.dirty && quit_times > 0) {
        editorSetStatusMessage("WARNING: Unsaved changes. Press Ctrl-Q %d more times to quit.",
                               quit_times);
        quit_times--;
        return;
      }
      write(STDOUT_FILENO, "\x1b[2J", 4);
      write(STDOUT_FILENO, "\x1b[H", 3);
      exit(0);
      break;

    case CTRL_KEY('s'):
      editorSave();
      break;

    case CTRL_KEY('f'):
      editorFind();
      break;

    case 0:
      editorAutocomplete();
      break;

    case HOME_KEY:
      E.cx = 0;
      break;

    case END_KEY:
      if (E.cy < E.numrows) E.cx = E.row[E.cy].size;
      break;

    case CTRL_KEY('h'):
    case BACKSPACE:
      editorDelChar();
      break;

    case DEL_KEY:
      editorMoveCursor(ARROW_RIGHT);
      editorDelChar();
      break;

    case PAGE_UP:
    case PAGE_DOWN: {
      if (c == PAGE_UP) {
        E.cy = E.rowoff;
      } else if (c == PAGE_DOWN) {
        E.cy = E.rowoff + E.screenrows - 1;
        if (E.cy > E.numrows) E.cy = E.numrows;
      }

      int times = E.screenrows;
      while (times--) editorMoveCursor(c == PAGE_UP ? ARROW_UP : ARROW_DOWN);
    } break;

    case ARROW_UP:
    case ARROW_DOWN:
    case ARROW_LEFT:
    case ARROW_RIGHT:
      editorMoveCursor(c);
      break;

    case CTRL_KEY('l'):
    case '\x1b':
      // Ignore / refresh
      break;

    case '\t':
      // Insert spaces instead of actual tab for simplicity
      for (int i = 0; i < TAB_STOP; i++) editorInsertChar(' ');
      break;

    default:
      if (!iscntrl(c) && c < 128) {
        editorInsertChar(c);
      }
      break;
  }

  quit_times = QUIT_TIMES;
}

static void editorInit(void) {
  E.cx = 0;
  E.cy = 0;
  E.rx = 0;
  E.rowoff = 0;
  E.coloff = 0;
  E.numrows = 0;
  E.row = NULL;
  E.dirty = 0;
  E.filename = NULL;
  E.statusmsg[0] = '\0';
  E.statusmsg_time = 0;
  E.keywords = NULL;
  E.hl_flags = 0;

  if (getWindowSize(&E.screenrows, &E.screencols) == -1) die("getWindowSize");
  E.screenrows -= 2; // status + message bar
}

int main(int argc, char *argv[]) {
  enableRawMode();
  editorInit();

  if (argc >= 2) {
    editorOpen(argv[1]);
  } else {
    editorSetStatusMessage("No file loaded. Run: ./weedit <filename>");
  }

  editorSetStatusMessage("Ctrl-S save | Ctrl-F find | Ctrl-Space autocomplete | Ctrl-Q quit");

  while (1) {
    editorRefreshScreen();
    editorProcessKeypress();
  }

  return 0;
}
