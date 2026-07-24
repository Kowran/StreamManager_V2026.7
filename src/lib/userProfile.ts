export function navigateToUserProfile(userId: string): void {
  window.history.pushState(null, '', `/user/${userId}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
