/**
 * seedDemoData.js
 * Seeds EricGram with demo users and posts.
 * Posts use bundled photo assets so demo content looks like real people.
 */

import {
	createPost,
	fetchAuthSession,
	followUser,
	getMessages,
	loginUser,
	sendMessage,
	setCurrentUser,
	signupUser,
} from "./api";

// ─── Demo users ───────────────────────────────────────────────────────────────
// Note: usernames must not contain dots — backend rejects them with stoll()

const DEMO_USERS = [
	{
		userName: "alex_wanderer",
		name: "Alex Chen",
		email: "alex@demo.ericgram.local",
		password: "Demo1234!",
		profilePic: "/assets/image.copy.png",
	},
	{
		userName: "sofia_creates",
		name: "Sofia Martinez",
		email: "sofia@demo.ericgram.local",
		password: "Demo1234!",
		profilePic: "/assets/image.png",
	},
	{
		userName: "kai_fotografy",
		name: "Kai Johnson",
		email: "kai@demo.ericgram.local",
		password: "Demo1234!",
		profilePic: "/assets/image.copy.png",
	},
	{
		userName: "luna_vibes",
		name: "Luna Park",
		email: "luna@demo.ericgram.local",
		password: "Demo1234!",
		profilePic: "/assets/beltran.jpg",
	},
	{
		userName: "marco_travels",
		name: "Marco Rossi",
		email: "marco@demo.ericgram.local",
		password: "Demo1234!",
		profilePic: "/assets/beltran.jpg",
	},
	{
		userName: "ava_lifestyle",
		name: "Ava Williams",
		email: "ava@demo.ericgram.local",
		password: "Demo1234!",
		profilePic: "/assets/beltran.jpg",
	},
	{
		userName: "sam_outdoors",
		name: "Sam Rivera",
		email: "sam@demo.ericgram.local",
		password: "Demo1234!",
		profilePic: "/assets/beltran.jpg",
	},
	{
		userName: "mia_aesthetic",
		name: "Mia Thompson",
		email: "mia@demo.ericgram.local",
		password: "Demo1234!",
		profilePic: "/assets/beltran.jpg",
	},
];
const SEEDED_DEMO_USER = {
	userName: "averagejoe",
	name: "Average Joe",
	email: "averagejoe@emaill.com",
	password: "1234",
	profilePic: "",
};

// ─── Demo posts ───────────────────────────────────────────────────────────────
const DEMO_POST_ASSETS = [
	"https://picsum.photos/seed/ericgram-sunrise/900/900",
	"https://picsum.photos/seed/ericgram-street/900/900",
	"https://picsum.photos/seed/ericgram-cafe/900/900",
	"https://picsum.photos/seed/ericgram-travel/900/900",
	"https://picsum.photos/seed/ericgram-lifestyle/900/900",
	"https://picsum.photos/seed/ericgram-landscape/900/900",
];

const DEMO_POSTS = [
	{
		user: "alex_wanderer",
		caption: "Every journey begins with a single step 🌍✈️",
		assetPath: "https://picsum.photos/seed/ericgram-hero/900/900",
	},
	{
		user: "sofia_creates",
		caption: "Art is not what you see, but what you make others see 🎨",
	},
	{
		user: "kai_fotografy",
		caption: "The mountains are calling and I must go 🏔️",
	},
	{ user: "luna_vibes", caption: "Golden hour hits different out here 🌅" },
	{ user: "marco_travels", caption: "Not all those who wander are lost 🧭" },
	{ user: "ava_lifestyle", caption: "Sipping on good vibes only ☕🌿" },
	{ user: "sam_outdoors", caption: "Nature is the best therapy 🌲💚" },
	{ user: "mia_aesthetic", caption: "Find beauty in the ordinary ✨" },
	{ user: "alex_wanderer", caption: "Chasing sunsets and good memories 🌇" },
	{
		user: "sofia_creates",
		caption: "Creativity is intelligence having fun 🖌️",
	},
	{
		user: "kai_fotografy",
		caption: "The best camera is the one you have with you 📸",
	},
	{ user: "luna_vibes", caption: "Lost in the right direction 🗺️" },
	{ user: "marco_travels", caption: "Life is short, eat the good food 🍜❤️" },
	{ user: "ava_lifestyle", caption: "Sunday mornings taste like this ☀️" },
	{ user: "sam_outdoors", caption: "Keep close to nature's heart 🍃" },
	{ user: "mia_aesthetic", caption: "Minimal vibes, maximal feelings 🤍" },
	{
		user: "alex_wanderer",
		caption: "Somewhere between the start and the finish ✈️",
	},
	{
		user: "sofia_creates",
		caption: "Make today so awesome yesterday gets jealous 💫",
	},
	{
		user: "kai_fotografy",
		caption: "Light is the brush, the world is the canvas 🌤️",
	},
	{ user: "marco_travels", caption: "Pasta, wine, and good company 🍷🍝" },
	{ user: "ava_lifestyle", caption: "Bloom where you are planted 🌸" },
	{
		user: "sam_outdoors",
		caption: "Adventure awaits just outside your door 🚴",
	},
	{
		user: "mia_aesthetic",
		caption: "The quieter you become, the more you hear 🌙",
	},
];
const AVERAGEJOE_POSTS = [
	{
		user: "averagejoe",
		caption: "Keeping the demo feed active one post at a time 📷",
	},
	{
		user: "averagejoe",
		caption: "Trying out a few sample posts for the timeline ✨",
	},
	{
		user: "averagejoe",
		caption: "Average Joe, above-average camera roll 😎",
	},
	{
		user: "averagejoe",
		caption: "Quick update before I jump back into my DMs 💬",
	},
];
const DEMO_FOLLOW_CONNECTIONS = [
	["averagejoe", "alex_wanderer"],
	["averagejoe", "sofia_creates"],
	["averagejoe", "mia_aesthetic"],
	["averagejoe", "kai_fotografy"],
	["alex_wanderer", "averagejoe"],
	["luna_vibes", "averagejoe"],
	["marco_travels", "averagejoe"],
	["ava_lifestyle", "averagejoe"],
	["sam_outdoors", "averagejoe"],
];
const DEMO_DM_THREADS = [
	{
		between: ["averagejoe", "alex_wanderer"],
		messages: [
			{ from: "alex_wanderer", text: "You should post those travel shots next." },
			{ from: "averagejoe", text: "I just added a few demo posts. Check the feed." },
			{
				from: "alex_wanderer",
				text: "This loop fits the vibe too.",
				mediaAssetPath: "/assets/hero-youtube-clip.gif",
				fileBaseName: "alex-wanderer-demo-gif",
			},
			{
				from: "averagejoe",
				text: "Perfect. Sending one back for the chat.",
				mediaAssetPath: "/assets/hero-badbunny-superbowl.gif",
				fileBaseName: "averagejoe-demo-gif",
			},
		],
	},
	{
		between: ["averagejoe", "sofia_creates"],
		messages: [
			{ from: "sofia_creates", text: "Want me to leave a few comments on your new posts?" },
			{ from: "averagejoe", text: "Yes, make the demo account look active." },
		],
	},
	{
		between: ["averagejoe", "mia_aesthetic"],
		messages: [
			{ from: "averagejoe", text: "Can you send me one more caption idea for reels?" },
			{ from: "mia_aesthetic", text: "Use something simple. Clean posts work best." },
		],
	},
];

const DEMO_AUTH_USERS = [SEEDED_DEMO_USER, ...DEMO_USERS];

function buildDemoPosts() {
	return [...DEMO_POSTS, ...AVERAGEJOE_POSTS].map((post) => ({
		...post,
		assetPath:
			DEMO_POST_ASSETS[
				Math.floor(Math.random() * DEMO_POST_ASSETS.length)
			],
	}));
}

function findAuthUser(userName) {
	return DEMO_AUTH_USERS.find((user) => user.userName === userName) || null;
}

async function loadAssetAsFile(assetPath, fileBaseName) {
	const response = await fetch(assetPath);
	if (!response.ok) {
		throw new Error(
			`Missing demo asset: ${assetPath}.`,
		);
	}

	const blob = await response.blob();
	const match = assetPath.match(/(\.[a-z0-9]+)$/i);
	const extension = match ? match[1].toLowerCase() : ".jpg";

	return new File([blob], `${fileBaseName}${extension}`, {
		type: blob.type || "application/octet-stream",
	});
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureDemoThreadMessages(thread) {
	const [user1, user2] = thread.between;
	try {
		const existing = await getMessages(user1, user2);
		const existingTexts = new Set(
			(existing.messages || []).map((message) =>
				`${message.from}|${(message.text || "").trim()}`,
			),
		);

		for (const message of thread.messages) {
			const key = `${message.from}|${message.text}`;
			if (existingTexts.has(key)) continue;
			const file =
				message.mediaAssetPath ?
					await loadAssetAsFile(
						message.mediaAssetPath,
						message.fileBaseName || `${message.from}-message`,
					)
				:	null;
			await sendMessage(
				message.from,
				message.to || (message.from === user1 ? user2 : user1),
				message.text,
				file,
			);
			await sleep(40);
		}
	} catch {
		for (const message of thread.messages) {
			const file =
				message.mediaAssetPath ?
					await loadAssetAsFile(
						message.mediaAssetPath,
						message.fileBaseName || `${message.from}-message`,
					)
				:	null;
			await sendMessage(
				message.from,
				message.to || (message.from === user1 ? user2 : user1),
				message.text,
				file,
			);
			await sleep(40);
		}
	}
}

async function restoreKnownSessionUser(userName) {
	const authUser = findAuthUser(userName);
	if (!authUser) {
		setCurrentUser(userName);
		return false;
	}

	const loginRes = await loginUser(authUser.email, authUser.password);
	setCurrentUser(loginRes?.user?.userName || authUser.userName);
	return true;
}

// ─── Main seeder ──────────────────────────────────────────────────────────────

/**
 * Seeds the backend with demo users + posts.
 * @param {Function} onProgress  - called with (message, percent)
 * @returns {Promise<{ usersCreated: number, postsCreated: number }>}
 */
export async function seedDemoData(onProgress = () => {}) {
	const demoPosts = buildDemoPosts();
	const total =
		DEMO_USERS.length +
		DEMO_FOLLOW_CONNECTIONS.length +
		DEMO_DM_THREADS.length +
		demoPosts.length;
	let done = 0;
	let newUsers = 0;
	let postsCreated = 0;
	let followsCreated = 0;
	let messagesCreated = 0;
	let originalSessionUserName = "";

	const report = (msg) => {
		done++;
		onProgress(msg, Math.round((done / total) * 100));
	};

	try {
		const session = await fetchAuthSession();
		originalSessionUserName = session?.user?.userName || "";
		if (originalSessionUserName) {
			setCurrentUser(originalSessionUserName);
		}
	} catch {
		originalSessionUserName = "";
	}

	// ── Step 1: Create / ensure all demo users exist ──────────────────────────
	onProgress("Creating demo users…", 0);
	for (const u of DEMO_USERS) {
		try {
			await signupUser({
				userName: u.userName,
				name: u.name,
				email: u.email,
				password: u.password,
				phoneNumber: "5559990000",
				instagramHandle: "",
				profilePic: u.profilePic,
			});
			newUsers++;
			report(`✓ Created @${u.userName}`);
		} catch {
			// Already exists — that's fine, we'll still post as them
			report(`· @${u.userName} already exists`);
		}
		await sleep(30);
	}

	// ── Step 2: Seed follow graph so averagejoe has followers + following ─────
	for (const [userName, friendUserName] of DEMO_FOLLOW_CONNECTIONS) {
		try {
			await followUser(userName, friendUserName);
			followsCreated++;
			report(`✓ @${userName} follows @${friendUserName}`);
		} catch {
			report(`· @${userName} already follows @${friendUserName}`);
		}
		await sleep(20);
	}

	// ── Step 3: Seed sample DM threads for averagejoe ─────────────────────────
	for (const thread of DEMO_DM_THREADS) {
		try {
			const existing = await getMessages(thread.between[0], thread.between[1]);
			const beforeCount = (existing.messages || []).length;
			await ensureDemoThreadMessages(thread);
			const after = await getMessages(thread.between[0], thread.between[1]);
			messagesCreated += Math.max(
				0,
				(after.messages || []).length - beforeCount,
			);
			report(
				`✓ Seeded DMs for @${thread.between[0]} and @${thread.between[1]}`,
			);
		} catch {
			await ensureDemoThreadMessages(thread);
			messagesCreated += thread.messages.length;
			report(
				`✓ Seeded DMs for @${thread.between[0]} and @${thread.between[1]}`,
			);
		}
		await sleep(30);
	}

	// ── Step 4: Log in as each user and create posts ──────────────────────────
	for (const p of demoPosts) {
		const userDef = findAuthUser(p.user);
		if (!userDef) {
			report(`⚠ No user def for ${p.user}`);
			continue;
		}

		try {
			// Log in as this user → get their session + register X-Auth-User
			const loginRes = await loginUser(userDef.email, userDef.password);
			const loggedInAs = loginRes?.user?.userName || userDef.userName;
			setCurrentUser(loggedInAs);

			const imageFile = await loadAssetAsFile(p.assetPath, p.user);

			// Upload the post
			await createPost(loggedInAs, p.caption, [imageFile]);
			postsCreated++;
			report(`✓ @${loggedInAs}: "${p.caption.slice(0, 32)}…"`);
		} catch (err) {
			report(`✗ Skipped (${String(err?.message || err).slice(0, 50)})`);
		}

		await sleep(80);
	}

	if (originalSessionUserName) {
		try {
			await restoreKnownSessionUser(originalSessionUserName);
		} catch {
			setCurrentUser(originalSessionUserName);
		}
	}

	return {
		usersCreated: newUsers,
		postsCreated,
		followsCreated,
		messagesCreated,
	};
}
