import { Toaster as Sonner } from "sonner"
import { useTheme } from "@/contexts/ThemeContext"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  // The app's own ThemeContext, NOT next-themes: there is no next-themes
  // provider here, so its hook forever answered "system" — and sonner then
  // resolved the OS scheme on its own, painting dark toasts over a light app.
  const { theme } = useTheme()

  return (
    <Sonner
      theme={theme}
      // Top of the screen, where a thumb on the bottom nav can't cover it.
      position="top-center"
      // sonner's own top offset is a bare 24px/16px with no safe-area maths, so
      // toasts rendered under the iPhone notch in a PWA and under Telegram's
      // floating buttons in a mini app. --inset-top covers both hosts.
      offset={{ top: 'calc(var(--inset-top, 0px) + 24px)' }}
      mobileOffset={{ top: 'calc(var(--inset-top, 0px) + 16px)' }}
      className="toaster group"
      toastOptions={{
        // The iOS banner: a floating glass capsule that hugs its text, neutral
        // surface, hairline edge — only the icon carries the state colour
        // (tinted in index.css). richColors' solid green/red slabs were the
        // opposite of minimal. Every colour utility is !important because
        // sonner's own [data-sonner-toast][data-styled] styles outrank plain
        // classes; index.css has a matching .tg-app rule that solidifies the
        // translucent background inside Telegram's glitchy webview.
        classNames: {
          toast:
            "group toast !w-fit mx-auto max-w-[calc(100vw-2rem)] items-center !gap-2.5 !rounded-full !border-border !bg-background/90 backdrop-blur-xl !text-foreground !shadow-[0_10px_32px_-8px_rgba(0,0,0,0.30)] !px-5 !py-3.5",
          title: "!text-[15px] !font-semibold tracking-tight",
          description: "!text-[13px] !text-muted-foreground",
          actionButton: "!bg-primary !text-primary-foreground !rounded-full !font-semibold",
          cancelButton: "!bg-muted !text-muted-foreground !rounded-full !font-semibold",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
