export function navigateToUserProfile(userId: string): void {
  window.location.href = `/user/${userId}`;
}
