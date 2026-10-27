export type PageId = "home" | "phones" | "alerts" | "keeper";
export type WordTab = "live" | "suggest" | "gemini" | "publish";
export type Route = { page: PageId; sub?: string };
export type Go = (page: PageId, sub?: string) => void;
