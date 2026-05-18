import { McpConnectionPanel } from '../components/integrations/McpConnectionPanel'

export function ConnectPage() {
  return (
    <section className="workspace-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl p-4 md:p-8">
        <McpConnectionPanel />
      </div>
    </section>
  )
}
