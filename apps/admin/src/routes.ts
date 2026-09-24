export type PageId = "home" | "phones" | "alerts" | "words" | "advanced";
export type WordTab = "live" | "suggest" | "gemini" | "publish";
export type AdvTab = "eval" | "dataset" | "jobs";
export type Route = { page: PageId; sub?: string };
export type Go = (page: PageId, sub?: string) => void;
