/**
 * Which lyric version is the public one?
 *
 * Kept here, as a pure function, because it is the whole of the rule and it is
 * easy to get subtly wrong. `SongsService.lyrics` used to serve the newest
 * *published* row, which is the same version as the pointer in every ordinary
 * case — but not after an unpublish, because `AdminService.unpublishLyrics`
 * flips `published: false` on that one version and leaves the older, already
 * superseded editions published. The endpoint then quietly served the previous
 * edition: the lyrics a fan read were not the ones the moderator had left live.
 *
 * `Song.syncedVersionId` is the denormalised pointer to the live version; it is
 * the answer whenever it is set. It is null for a song whose lyrics are
 * unsynchronized in the legacy sense (published before the pointer existed) and
 * for a song with no published lyrics at all, so the fallback still has to
 * handle both.
 */
export function selectPublishedVersion<T extends { id: string }>(
  versions: readonly T[],
  syncedVersionId: string | null,
): T | null {
  const pointed = syncedVersionId
    ? versions.find((version) => version.id === syncedVersionId)
    : undefined;
  // The fallback assumes `versions` arrive newest-first, which is how the query
  // orders them.
  return pointed ?? versions[0] ?? null;
}
