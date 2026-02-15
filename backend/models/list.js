import mongoose from "mongoose";

const ListSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isPrivate: { type: Boolean, default: false },
  },
  { timestamps: true },
);

ListSchema.index({ owner: 1, createdAt: -1 });
ListSchema.index({ members: 1 });
ListSchema.index({ name: "text", description: "text" });

export default mongoose.model("List", ListSchema);
