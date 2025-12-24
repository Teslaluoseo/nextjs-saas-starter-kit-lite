export function AppLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="h-8 w-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold">
        BG
      </div>

      <div className="leading-tight">
        <div className="font-semibold">Blog Generator</div>
        <div className="text-xs text-muted-foreground -mt-0.5">Workspace</div>
      </div>
    </div>
  );
}
