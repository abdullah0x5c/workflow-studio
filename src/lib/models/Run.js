import mongoose from 'mongoose'

const NodeRunSchema = new mongoose.Schema(
  {
    nodeId: { type: String, required: true },
    type: { type: String, default: null },
    status: {
      type: String,
      enum: ['pending', 'running', 'success', 'failed', 'skipped'],
      default: 'pending',
    },
    branch: { type: String, default: null },
    startedAt: { type: String, default: null },
    finishedAt: { type: String, default: null },
    durationMs: { type: Number, default: null },
    input: { type: mongoose.Schema.Types.Mixed, default: null },
    output: { type: mongoose.Schema.Types.Mixed, default: null },
    error: { type: String, default: null },
    logs: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { _id: false, strict: false }
)

const RunSchema = new mongoose.Schema(
  {
    workflowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workflow',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['running', 'success', 'failed'],
      default: 'running',
      index: true,
    },
    runKey: { type: String, default: null },
    startedAt: { type: String, default: null },
    finishedAt: { type: String, default: null },
    durationMs: { type: Number, default: null },
    error: { type: String, default: null },
    nodeRuns: { type: [NodeRunSchema], default: [] },
  },
  { timestamps: true }
)

RunSchema.index({ workflowId: 1, createdAt: -1 })

const Run = mongoose.models.Run || mongoose.model('Run', RunSchema)

export default Run
