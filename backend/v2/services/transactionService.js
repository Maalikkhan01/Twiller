import mongoose from "mongoose";

const isTransactionUnsupported = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("transaction numbers are only allowed") ||
    message.includes("replica set") ||
    message.includes("mongos")
  );
};

export const runWithOptionalTransaction = async (operation) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await operation(session);
    });
    return result;
  } catch (error) {
    if (isTransactionUnsupported(error)) {
      return operation(null);
    }
    throw error;
  } finally {
    await session.endSession();
  }
};
