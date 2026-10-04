// The mods' own tsconfig, which the engine writes beside a loaded mod, types
// them against the real API. Here they are only imported for previews and
// specs, so the names they take from it stay loose.
declare module 'claude-code' {
  export type ElementTable<Surface extends string = string> = Record<string, any>
  export type TextProps = Record<string, unknown>
}
