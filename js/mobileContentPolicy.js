(function (root, factory) {
    const policy = factory();
    if (typeof module === 'object' && module.exports) module.exports = policy;
    else root.mobileContentPolicy = policy;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const BLOCKED_VIDEO_ID = '8JMOD5WsBDM';

    function isBlockedVideo(url) {
        if (typeof url !== 'string') return false;
        try {
            const parsed = new URL(url);
            const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
            if (host === 'youtu.be') return parsed.pathname.split('/')[1] === BLOCKED_VIDEO_ID;
            if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
                return parsed.searchParams.get('v') === BLOCKED_VIDEO_ID
                    || parsed.pathname.split('/').includes(BLOCKED_VIDEO_ID);
            }
        } catch {}
        return false;
    }

    function isPronunciationPart(part) {
        return part?.kind === 'pronunciation'
            || /talaffuz\s*mashq|pronunciation\s*check/i.test(part?.title || '');
    }

    // Only the confirmed unrelated video and unwanted sections are removed.
    // Lesson IDs, authored text, other exercises and all student results stay intact.
    function sanitizeMobileContent(mc) {
        for (const content of Object.values(mc.lessonContents || {})) {
            if (isBlockedVideo(content.videoUrl)) content.videoUrl = '';
            if (Array.isArray(content.homeworkParts)) {
                content.homeworkParts = content.homeworkParts.filter(p => !isPronunciationPart(p));
            }
        }
        for (const content of mc.moduleContents || []) {
            if (content.type === 'video' && isBlockedVideo(content.url)) content.url = '';
        }
        return mc;
    }

    return { isBlockedVideo, isPronunciationPart, sanitizeMobileContent };
});
