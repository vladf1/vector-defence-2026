interface ImportMeta {
  readonly hot?: unknown;
}

declare module "*.css";

declare module "*.m4a" {
  const url: string;
  export default url;
}
