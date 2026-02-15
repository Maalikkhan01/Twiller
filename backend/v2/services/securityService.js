import User from "../../models/user.js";

const asStringSet = (items = []) =>
  new Set(items.map((item) => item?.toString()).filter(Boolean));

export const buildVisibilityContext = async (currentUser) => {
  if (!currentUser?._id) {
    return {
      blockedUserIds: [],
      mutedUserIds: [],
      blockedByUserIds: [],
      followingIds: [],
    };
  }

  const blockedBy = await User.find({
    blockedUsers: currentUser._id,
  }).select("_id");

  const blockedSet = asStringSet(currentUser.blockedUsers);
  const mutedSet = asStringSet(currentUser.mutedUsers);
  const followingSet = asStringSet(currentUser.following);
  const blockedBySet = new Set(blockedBy.map((item) => item._id.toString()));

  return {
    blockedUserIds: Array.from(blockedSet),
    mutedUserIds: Array.from(mutedSet),
    blockedByUserIds: Array.from(blockedBySet),
    followingIds: Array.from(followingSet),
  };
};

export const buildVisibilityMatch = (context) => {
  const excluded = new Set([
    ...(context?.blockedUserIds || []),
    ...(context?.mutedUserIds || []),
    ...(context?.blockedByUserIds || []),
  ]);

  const match = {
    moderationFlag: { $ne: true },
  };

  if (excluded.size) {
    match.author = { $nin: Array.from(excluded) };
  }

  return match;
};

export const canReplyToTweet = ({ parentTweet, parentAuthor, currentUser }) => {
  if (!parentTweet || !parentAuthor || !currentUser) {
    return false;
  }

  if (parentAuthor._id.toString() === currentUser._id.toString()) {
    return true;
  }

  const isFollower = (parentAuthor.followers || []).some(
    (followerId) => followerId.toString() === currentUser._id.toString(),
  );

  if (parentAuthor.privateAccount && !isFollower) {
    return false;
  }

  if (parentTweet.replyRestriction === "followers" && !isFollower) {
    return false;
  }

  if (parentTweet.replyRestriction === "mentioned") {
    const mentioned = (parentTweet.mentions || []).map((item) =>
      String(item).toLowerCase(),
    );
    const username = String(currentUser.username || "").toLowerCase();
    if (!mentioned.includes(username)) {
      return false;
    }
  }

  return true;
};
