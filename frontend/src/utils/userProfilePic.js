const assetModules = import.meta.glob("../assets/*.{png,jpg,jpeg,webp}", {
	eager: true,
	import: "default",
});

const IGNORED_ASSET_FRAGMENTS = [
	"logo",
	"react",
	"instagram-mark",
];

const ASSET_PROFILE_PICS = Object.entries(assetModules)
	.filter(
		([assetPath]) =>
			!IGNORED_ASSET_FRAGMENTS.some((fragment) =>
				assetPath.toLowerCase().includes(fragment),
			),
	)
	.map(([, assetUrl]) => assetUrl)
	.sort();

function hashUserName(userName) {
	let hash = 0;
	for (let i = 0; i < userName.length; i += 1) {
		hash = (hash * 31 + userName.charCodeAt(i)) >>> 0;
	}
	return hash;
}

export function getRandomAssetProfilePic(userName = "") {
	if (!ASSET_PROFILE_PICS.length) return "";
	const normalized = String(userName || "user");
	const index = hashUserName(normalized) % ASSET_PROFILE_PICS.length;
	return ASSET_PROFILE_PICS[index];
}

export function getUserProfilePic(user) {
	const userName = user?.userName || "";
	if (userName === "ericphXm") {
		return "/assets/images (1).jpeg";
	}
	if (userName === "alice123") {
		return "/assets/images.jpeg";
	}
	if (userName === "JensenHuang") {
		return "/assets/image copy.png";
	}
	return user?.profilePic || getRandomAssetProfilePic(userName);
}
