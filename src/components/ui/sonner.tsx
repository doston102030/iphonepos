"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      // Top of the screen, where a thumb on the bottom nav can't cover it, and
      // coloured by kind so a green "done" reads at a glance.
      position="top-center"
      // sonner's own top offset is a bare 24px/16px with no safe-area maths, so
      // toasts rendered under the iPhone notch in a PWA and under Telegram's
      // floating buttons in a mini app. --inset-top covers both hosts.
      offset={{ top: 'calc(var(--inset-top, 0px) + 24px)' }}
      mobileOffset={{ top: 'calc(var(--inset-top, 0px) + 16px)' }}
      richColors
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-2xl",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
