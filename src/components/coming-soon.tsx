import { Card } from "@/components/ui/card"

export function ComingSoon() {
  return (
    <Card className="p-8 flex flex-col items-center justify-center min-h-[400px] text-center">
      <h1 className="text-3xl font-bold mb-4">🚧 Coming Soon</h1>
      <p className="text-muted-foreground text-lg">
        We're working hard to bring you this feature. Stay tuned!
      </p>
    </Card>
  )
}
