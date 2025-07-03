import { Agent } from "@atproto/api";
import { ProfileView } from "@atproto/api/dist/client/types/app/bsky/actor/defs.js";

const LIMIT_TOTAL = 10_000
const LIMIT_PER_REQUEST = 100
const DELAY = 50
const BSKY_PROFILE_URL = "https://bsky.app/profile"
const BSKY_API_URL = "https://public.api.bsky.app"

enum Mode { Known = "known", Followers = "followers", Follows = "follows" }

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const spinner = document.getElementById("spinner") as HTMLImageElement
const viewerInput = document.getElementById("viewer") as HTMLInputElement
const targetInput = document.getElementById("target") as HTMLInputElement
const viewerLabel = document.getElementById("label-viewer") as HTMLLabelElement
const targetLabel = document.getElementById("label-target") as HTMLLabelElement
const selectBox = document.getElementById("select-mode") as HTMLSelectElement
const hintSpan = document.getElementById("known-hint") as HTMLSpanElement
const submitButton = document.getElementById("submit") as HTMLInputElement
const stopButton = document.getElementById("stop") as HTMLInputElement
const formElement = document.getElementById("form") as HTMLFormElement
const listDiv = document.getElementById("list") as HTMLDivElement
const listDescriptions = Object.freeze({
    "known": document.getElementById("list-desc-known") as HTMLHeadingElement,
    "followers": document.getElementById("list-desc-followers") as HTMLHeadingElement,
    "follows": document.getElementById("list-desc-follows") as HTMLHeadingElement
})
const listDescViewers = Object.fromEntries(
    Object.entries(listDescriptions).map(([key, element]) =>
        [key, element.querySelector(".list-desc-viewer") as HTMLAnchorElement]
    )
)
const listDescTargets = Object.fromEntries(
    Object.entries(listDescriptions).map(([key, element]) =>
        [key, element.querySelector(".list-desc-target") as HTMLAnchorElement]
    )
)
let activeMode = Mode.Followers
let stop = false

const agent = new Agent((url, init) => fetch(BSKY_API_URL + url))

function createProfileItem(profile: ProfileView) {
    const card = document.createElement("div")
    card.className = "card"

    const pfpHandle = document.createElement("div")
    pfpHandle.className = "pfp-handle"
    card.append(pfpHandle)

    if (profile.avatar) {
        const pfp = document.createElement("img")
        pfp.className = "pfp"
        pfp.src = profile.avatar
        pfpHandle.append(pfp)
    }

    const handleWrapper = document.createElement("div")
    handleWrapper.className = "handle-wrapper"
    pfpHandle.append(handleWrapper)

    if (profile.displayName) {
        const displayName = document.createElement("div")
        displayName.className = "display-name"
        displayName.append(document.createTextNode(profile.displayName))
        handleWrapper.append(displayName)
    }

    const handle = document.createElement("a")
    handle.className = "handle"
    handle.append(document.createTextNode("@" + profile.handle))
    handle.href = `${BSKY_PROFILE_URL}/${profile.handle}`
    handleWrapper.append(handle)

    if (profile.description) {
        const description = document.createElement("div")
        description.className = "description"
        description.append(document.createTextNode(profile.description))
        card.append(description)
    }
    return card
}

async function resolveHandle(handle: string) {
    try {
        const res = await agent.com.atproto.identity.resolveHandle({
            handle: handle
        })
        if (!res.success) return null
        return res.data.did
    } catch (err) {
        return null
    }
}

async function getAllFollows(actor: string, profiles: Map<string, ProfileView>) {
    let cursor;
    do {
        await sleep(DELAY)
        const res = await agent.app.bsky.graph.getFollows({
            actor: actor,
            cursor: cursor,
            limit: LIMIT_PER_REQUEST
        })
        cursor = res.data.cursor
        res.data.follows.forEach((v) => profiles.set(v.did, v))
    } while (!stop && cursor && (!LIMIT_TOTAL || profiles.size < LIMIT_TOTAL));
}

async function getAllFollowers(actor: string, profiles: Map<string, ProfileView>) {
    let cursor;
    do {
        await sleep(DELAY)
        const res = await agent.app.bsky.graph.getFollowers({
            actor: actor,
            cursor: cursor,
            limit: LIMIT_PER_REQUEST
        })
        cursor = res.data.cursor
        res.data.followers.forEach((v) => profiles.set(v.did, v))
    } while (!stop && cursor && (!LIMIT_TOTAL || profiles.size < LIMIT_TOTAL));
}

async function submit(opts: { viewer: string, target: string }) {
    viewerInput.setCustomValidity("")
    targetInput.setCustomValidity("")

    const viewer = await resolveHandle(opts.viewer)
    const target = await resolveHandle(opts.target)
    let error = false
    if (!viewer) {
        viewerInput.setCustomValidity("Invalid handle")
        error = true
    }
    if (!target) {
        targetInput.setCustomValidity("Invalid handle")
        error = true
    }
    if (error) {
        console.log(`Invalid handle`)
        throw new Error("Invalid handle")
    }

    const viewerProfiles: Map<string, ProfileView> = new Map()
    const targetProfiles: Map<string, ProfileView> = new Map()
    const common: Map<string, ProfileView> = new Map()

    switch (activeMode) {
        case Mode.Known:
            await getAllFollows(viewer!, viewerProfiles)
            await getAllFollowers(target!, targetProfiles)
            break
        case Mode.Followers:
            await getAllFollowers(viewer!, viewerProfiles)
            await getAllFollowers(target!, targetProfiles)
            break
        case Mode.Follows:
            await getAllFollows(viewer!, viewerProfiles)
            await getAllFollows(target!, targetProfiles)
            break
    }

    for (const [did, profile] of viewerProfiles.entries()) {
        if (targetProfiles.get(did)) {
            common.set(did, profile)
        }
    }
    return common
}

async function onSubmit() {
    try {
        listDescriptions[activeMode].style.display = 'none'
        activeMode = selectBox.value as Mode

        submitButton.disabled = true
        stopButton.disabled = false
        selectBox.disabled = true
        spinner.style.display = "block"
        listDiv.replaceChildren()

        const viewer = viewerInput.value.trim().replace(/^@/, "")
        const target = targetInput.value.trim().replace(/^@/, "")
        const list = await submit({ viewer, target })

        const fragment = new DocumentFragment()
        list.forEach((profile) => fragment.append(createProfileItem(profile)))
        listDiv.append(fragment)

        listDescViewers[activeMode].replaceChildren(viewer)
        listDescTargets[activeMode].replaceChildren(target)
        listDescViewers[activeMode].href = `${BSKY_PROFILE_URL}/${viewer}`
        listDescTargets[activeMode].href = `${BSKY_PROFILE_URL}/${target}`

        listDescriptions[activeMode].style.display = "block"
    } catch (err) {
        console.log(err)
    } finally {
        selectBox.disabled = false
        submitButton.disabled = false
        stopButton.disabled = true
        spinner.style.display = "none"
        stop = false
    }
}

function onChangeMode() {
    const mode = selectBox.value as Mode
    switch (mode) {
        case Mode.Known:
            viewerLabel.textContent = "Viewer"
            targetLabel.textContent = "Target"
            hintSpan.style.display = 'inline'
            break;
        default:
            viewerLabel.textContent = "User 1"
            targetLabel.textContent = "User 2"
            hintSpan.style.display = 'none'
    }
}

viewerInput.onclick = () => viewerInput.setCustomValidity("")

targetInput.onclick = () => targetInput.setCustomValidity("")

formElement.onsubmit = (ev) => {
    ev.preventDefault();
    onSubmit()
};
selectBox.onchange = onChangeMode
stopButton.onclick = () => stop = true
