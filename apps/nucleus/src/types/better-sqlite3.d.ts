declare module "better-sqlite3" {
  export interface Statement {
    run: (...args: unknown[]) => unknown;
    get: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
  }

  export interface Transaction<TArgs extends unknown[] = unknown[], TResult = unknown> {
    (...args: TArgs): TResult;
  }

  export interface Database {
    pragma: (sql: string) => unknown;
    exec: (sql: string) => unknown;
    prepare: (sql: string) => Statement;
    transaction: <TArgs extends unknown[] = unknown[], TResult = unknown>(
      fn: (...args: TArgs) => TResult
    ) => Transaction<TArgs, TResult>;
    close: () => void;
  }

  namespace Database {
    export type Database = import("better-sqlite3").Database;
  }

  const BetterSqlite3: {
    new (filename: string): Database;
  };

  export default BetterSqlite3;
}
