export const isFirebaseConfigured = false;
export const db: null = null;
export const auth: null = null;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  throw new Error(`Legacy cloud disabled: ${operationType} ${path || ''} ${String(error)}`.trim());
}

export function collection(..._args: unknown[]): any {
  throw new Error('Legacy cloud disabled');
}

export function doc(..._args: unknown[]): any {
  throw new Error('Legacy cloud disabled');
}

export function getDocs(..._args: unknown[]): any {
  throw new Error('Legacy cloud disabled');
}

export function getDoc(..._args: unknown[]): any {
  throw new Error('Legacy cloud disabled');
}

export function setDoc(..._args: unknown[]): any {
  throw new Error('Legacy cloud disabled');
}

export function deleteDoc(..._args: unknown[]): any {
  throw new Error('Legacy cloud disabled');
}
