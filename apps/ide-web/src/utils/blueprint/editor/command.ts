// Editor: Command Pattern (Undo/Redo & Debugging)
export interface Command {
  name: string;
  do(): void;
  undo(): void;
}

export class CommandStack {
  private done: Command[] = [];
  private undone: Command[] = [];

  exec(cmd: Command) {
    cmd.do();
    this.done.push(cmd);
    this.undone.length = 0;
  }

  undo() {
    const c = this.done.pop();
    if (!c) return;
    c.undo();
    this.undone.push(c);
  }

  redo() {
    const c = this.undone.pop();
    if (!c) return;
    c.do();
    this.done.push(c);
  }

  debug() {
    return {
      done: this.done.map((c) => c.name),
      undone: this.undone.map((c) => c.name),
    };
  }

  canUndo() {
    return this.done.length > 0;
  }

  canRedo() {
    return this.undone.length > 0;
  }

  clear() {
    this.done.length = 0;
    this.undone.length = 0;
  }
}

export class MoveObject implements Command {
  private prev: [number, number, number];

  constructor(
    public name: string,
    private obj: { position: [number, number, number] },
    private to: [number, number, number]
  ) {
    this.prev = [...obj.position];
  }

  do() {
    this.obj.position = [...this.to];
  }

  undo() {
    this.obj.position = [...this.prev];
  }
}
