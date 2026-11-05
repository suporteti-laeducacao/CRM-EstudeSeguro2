import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-xl group-[.toaster]:bg-ink-950 group-[.toaster]:text-white group-[.toaster]:border-ink-800 group-[.toaster]:border-l-[3px] group-[.toaster]:shadow-pop",
          description: "group-[.toast]:text-ink-300",
          actionButton: "group-[.toast]:bg-brand group-[.toast]:text-brand-foreground",
          cancelButton: "group-[.toast]:bg-ink-800 group-[.toast]:text-ink-300",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
