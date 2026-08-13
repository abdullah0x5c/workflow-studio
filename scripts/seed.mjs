import mongoose from 'mongoose'
import Workflow from '../src/lib/models/Workflow.js'
import {
  createStarterWorkflow,
  STARTER_WORKFLOW_NAME,
} from '../src/lib/engine/starter.js'

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/workflow_studio'

async function main() {
  await mongoose.connect(uri)
  const count = await Workflow.countDocuments()
  if (count > 0) {
    console.log(`Skipping seed: ${count} workflow(s) already exist.`)
    return
  }
  const { nodes, edges } = createStarterWorkflow()
  const workflow = await Workflow.create({
    name: STARTER_WORKFLOW_NAME,
    description: 'Demo: Manual Trigger -> Code -> If -> Set / Delay',
    nodes,
    edges,
  })
  console.log(`Seeded workflow ${workflow._id.toString()}`)
}

main()
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
