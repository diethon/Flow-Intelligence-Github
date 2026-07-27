/**
 * Canonical Commit model lives in ./Commit. This file is kept as a thin
 * re-export so existing imports (`commit.model`) keep working while only a
 * single mongoose model is registered for the `commits` collection.
 */
export { Commit } from './Commit';
export type { ICommit } from './Commit';
