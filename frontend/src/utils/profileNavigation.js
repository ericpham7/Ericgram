export function getProfilePath(userName, currentUserName) {
	if (!userName || userName === currentUserName) {
		return "/profile";
	}

	return `/profile/${encodeURIComponent(userName)}`;
}

export function navigateToProfile(navigate, userName, currentUserName) {
	navigate(getProfilePath(userName, currentUserName));
}
