export type Attachment = {
  id: string;
  name: string;
  type: string;
  size: number;
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  attachment?: Attachment;
};

export type Conversation = {
  id: string;
  title: string;
  topic: string;
  updatedAt: number;
  messages: Message[];
  attachments: Attachment[];
};

type StoredFile = { id: string; file: File };

const DATABASE = "study-buddy";
const VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      database.createObjectStore("conversations", { keyPath: "id" });
      database.createObjectStore("files", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadConversations(): Promise<Conversation[]> {
  const database = await openDatabase();
  const result = await requestResult<Conversation[]>(database.transaction("conversations").objectStore("conversations").getAll());
  database.close();
  return result.sort((first, second) => second.updatedAt - first.updatedAt);
}

export async function saveConversations(conversations: Conversation[]): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction("conversations", "readwrite");
  const store = transaction.objectStore("conversations");
  conversations.forEach((conversation) => store.put(conversation));
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  database.close();
}

export async function saveFile(id: string, file: File): Promise<void> {
  const database = await openDatabase();
  await requestResult(database.transaction("files", "readwrite").objectStore("files").put({ id, file } satisfies StoredFile));
  database.close();
}

export async function loadFile(id: string): Promise<File | undefined> {
  const database = await openDatabase();
  const result = await requestResult<StoredFile | undefined>(database.transaction("files").objectStore("files").get(id));
  database.close();
  return result?.file;
}

export async function deleteConversation(conversation: Conversation): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(["conversations", "files"], "readwrite");
  transaction.objectStore("conversations").delete(conversation.id);
  conversation.attachments.forEach((attachment) => transaction.objectStore("files").delete(attachment.id));
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  database.close();
}