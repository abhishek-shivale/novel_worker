import { Hono } from "hono";
import { CheerioAPI, load } from "cheerio";
import { cors } from "hono/cors";
import { EdgeTTS, OUTPUT_FORMAT } from "./edge";
import { cache } from "hono/cache";

const BASE_URL = "https://novelbin.me";
const app = new Hono<{ Bindings: CloudflareBindings }>();

// Cache middleware for all routes except /api/tts
const cacheMiddleware = cache({
  cacheName: "novelbin-cache",
  cacheControl: "max-age=7200", // 2 hours
});

const MediaMiddleware = cache({
  cacheName: "novelbin-cache",
  cacheControl: "max-age=720000", // 2 hours
});

async function getFun(url: string) {
  const response = await fetch(url);
  const html = await response.text();
  const $ = load(html);
  return $;
}

function getNovel($: CheerioAPI) {
  let novels: {
    title: string;
    link: string;
    image: string;
    author: string;
    chapter_info: { title: string; link: string };
  }[] = [];
  $(".list-novel > .row").each((index, element) => {
    const title = $(element).find("a").attr("title")?.trim();
    let link = $(element).find("a").attr("href")?.trim();
    let image = $(element).find("img").attr("data-src");
    let author = $(element).find(".author").text().trim();
    let chapter_info = {
      title: $(element).find(".text-info").text().trim(),
      link: $(element).find(".text-info a").attr("href")?.trim() as string,
    };

    if (link) {
      link.includes(BASE_URL) ? (link = link.replace(BASE_URL, "")) : "";
    }

    if (chapter_info.link) {
      chapter_info.link.includes(BASE_URL)
        ? (chapter_info.link = chapter_info.link.replace(BASE_URL, ""))
        : "";
    }
    if (!image) {
      image = $(element).find("img").attr("src");
    }
    if (image) {
      image.includes(BASE_URL) ? (image = image.replace(BASE_URL, "")) : "";
    }
    novels.push({
      title: title as string,
      link: link as string,
      image: image as string,
      author,
      chapter_info,
    });
  });

  return novels.filter((novel) => novel.image && novel.link && novel.title);
}

app.use(
  "/*",
  cors({
   origin: ["https://webnovelhub.online/*", "https://webnovelhub.online"],
  })
);
app.use('/*', async (c, next) => {
  const origin = c.req.header('origin')
  const userAgent = c.req.header('user-agent') || ''

  if (origin === 'https://webnovelhub.online') {
    c.header('Access-Control-Allow-Origin', origin)
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (c.req.method === 'OPTIONS') {
      return c.text('', 200)
    }

    await next()
    return
  }

  if (userAgent.includes('Postman')) {
    return c.json({ error: 'Access denied' }, 403)
  }

  if (userAgent.includes('Mozilla') ||
      userAgent.includes('Chrome') ||
      userAgent.includes('Safari') ||
      userAgent.includes('Firefox') ||
      userAgent.includes('Edge')) {
    return c.json({ error: 'Access denied' }, 403)
  }

  return c.json({ error: 'Access denied' }, 403)
})

app.get("/", cacheMiddleware, async (c) => {
  const $ = await getFun(`${BASE_URL}`);
  const genres: { name: string; link: string }[] = [];
  /*
    genres = base_url + /novelbin-genres + {genre_name}
  */
  $(".navbar-collapse .dropdown-menu a").each((index, element) => {
    const genreName = $(element).text().trim();
    let genreLink = $(element).attr("href");
    if (genreLink) {
      genreLink.includes(BASE_URL)
        ? (genreLink = genreLink.replace(BASE_URL, ""))
        : "";
      genreLink.includes("novelbin-genres")
        ? (genreLink = genreLink.replace("/novelbin-genres", ""))
        : "";
    }
    genres.push({ name: genreName, link: genreLink as string });
  });

  const novels: { title: string; link: string; image: string }[] = [];

  $(".index-novel .item a").each((index, element) => {
    const title = $(element).attr("title")?.trim();
    let link = $(element).attr("href")?.trim();
    let image = $(element).find("img").attr("data-src");

    if (image) {
      image.includes(BASE_URL) ? (image = image.replace(BASE_URL, "")) : "";
    }

    if (link) {
      link.includes(BASE_URL) ? (link = link.replace(BASE_URL, "")) : "";
    }

    novels.push({
      title: title as string,
      link: link as string,
      image: image as string,
    });
  });

  let latest_novels: { title: string; link: string; image: string }[] = [];
  let x = await getFun(`${BASE_URL}/sort/novelbin-daily-update`);
  latest_novels = getNovel(x);

  return c.json({
    genres: genres.slice(6),
    top_novels: novels,
    latest_novels: latest_novels,
  });
});

app.get("/:genre", cacheMiddleware, async (c) => {
  const genre = c.req.param("genre");
  const $ = await getFun(`${BASE_URL}/novelbin-genres/${genre}`);
  let novels = getNovel($);
  return c.json({ genre: novels });
});

app.get("/novel-book/:name",  cacheMiddleware, async (c) => {
  const all_chapter = c.req.query("all");
  const name = c.req.param("name");
  const $ = await getFun(`${BASE_URL}/novel-book/${name}`);

  let title = $(".desc .title").text().trim();
  let author = $('meta[itemprop="name"]').attr("content") || "Unknown";
  const image = $('meta[itemprop="image"]').attr("content");
  const rating = $('span[itemprop="ratingValue"]').text().trim();
  const reviewCount = $('span[itemprop="reviewCount"]').text().trim();
  const status = $('li h3:contains("Status:")').next("a").text().trim();
  const publisher = $('li h3:contains("Publishers:")').next().text().trim();
  const year = $('li h3:contains("Year of publishing:")')
    .next("a")
    .text()
    .trim();
  let readNowLink = $("a.btn-read-now").attr("href");

  if (author) {
    author = author.replace("- Novel Bin", "").trim();
  }

  const genres: string[] = [];
  $('meta[itemprop="genre"]').each((index, element) => {
    genres.push(
      ($(element).attr("content") as string).replace(
        "https://novelbin.me/novelbin-genres/",
        ""
      )
    );
  });

  const tags: string[] = [];
  $(".tag-container a").each((index, element) => {
    tags.push($(element).text().trim());
  });

  if (readNowLink) {
    readNowLink = readNowLink.includes(BASE_URL)
      ? readNowLink.replace(BASE_URL, "")
      : readNowLink;
  }

  title = title.replace(/^(.+?)\1+$/, '$1').trim()

  const novelData = {
    title,
    author,
    image,
    rating,
    reviewCount,
    status,
    publisher,
    year,
    genres,
    tags,
    readNowLink,
  };
  const description = $(".desc-text").text().trim();
  let allChapters = $(".list-chapter a")
    .map((i, el) => ({
      title: $(el).text().trim(),
      link: ($(el).attr("href") as string).replace(BASE_URL, ""),
    }))
    .get();
  if (all_chapter) {
    const url = `${BASE_URL}/ajax/chapter-archive?novelId=${name.replace(
      / /g,
      "-"
    )}`;
    const x = await getFun(url);
    const chapters: { chapterNumber: number; title: string; url: string }[] =
      [];

    // Find all chapter links
    x(".list-chapter li a").each((index, element) => {
      const title = $(element).find(".chapter-title").text().trim();
      const url = $(element).attr("href");

      chapters.push({
        chapterNumber: index + 1,
        title: title,
        url: url as string,
      });
    });

    allChapters = chapters.map((chapter) => ({
      title: chapter.title,
      link: chapter.url.replace(BASE_URL, ""),
    }));
  }
  // return c.text($.html());
  return c.json({ novelData, description, allChapters });
});

app.get("/novel-book/:name/:chapter", cacheMiddleware, async (c) => {
  const name = c.req.param("name");
  const chapter = c.req.param("chapter");
  const $ = await getFun(`${BASE_URL}/novel-book/${name}/${chapter}`);
  const nove_title = $(".novel-title").text().trim();
  const chap_title = $(".chr-title").text().trim();
  const next_chapter = {
    title: $("#next_chap").attr("title") as string || "",
    link: $("#next_chap").attr("href") as string,
  };
  const prev_chapter = {
    title: $("#prev_chap").attr("title") as string|| "",
    link: $("#prev_chap").attr("href") as string,
  };
  if (
    next_chapter.link &&
    BASE_URL &&
    next_chapter.link.includes("https://novelbin.com/b")
  ) {
    next_chapter.link = next_chapter.link.replace("https://novelbin.com/b", "");
    next_chapter.link = "/novel-book" + next_chapter.link;
  }

  if (
    prev_chapter.link &&
    BASE_URL &&
    prev_chapter.link.includes("https://novelbin.com/b")
  ) {
    prev_chapter.link = prev_chapter.link.replace("https://novelbin.com/b", "");
    prev_chapter.link = "/novel-book" + prev_chapter.link;
  }
  let content = $("#chr-content > p").text().trim();
  content = content.replace(/NovelBin\.[^\s]+/gi, "")
  return c.json({
    nove_title,
    chap_title,
    next_chapter,
    prev_chapter,
    content,
  });
});

app.get("/search/:keyword", cacheMiddleware, async (c) => {
  const query = c.req.param("keyword") as string;
  if (!query) return c.json({ novels: [] });
  const $ = await getFun(
    `${BASE_URL}/search?keyword=${query.replace(/ /g, "-")}`
  );
  const novels = getNovel($);
  return c.json(novels);
});

app.get("/api/tts/voices", MediaMiddleware, async (c) => {
  try {
    const edgeTTS = new EdgeTTS(
      "en-US-ChristopherNeural",
      OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3
    );
    let voices = await edgeTTS.getVoices();
    voices = voices.filter((voice) => voice.Locale === "en-US");
    return c.json(
      //@ts-ignore
      voices.map(({ Name, FriendlyName, VoiceTag, ...rest }) => rest)
    );
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// No cache for the TTS endpoint since it's dynamic audio generation

app.post("/api/tts", async (c) => {
  try {
    const body = await c.req.json();
    const {
      text,
      voice = "en-US-ChristopherNeural",
      rate = "+0%",
      pitch = "+0%",
      volume = "medium",
    } = body;

    if (!text) {
      return c.json({ error: "Text is required" }, 400);
    }

    const edgeTTS = new EdgeTTS(
      voice,
      OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
      { wordBoundaryEnabled: false, sentenceBoundaryEnabled: false }
    );

    const audioStream = await edgeTTS.textToSpeechStream(text, {
      rate,
      pitch,
      volume,
    });

    return new Response(audioStream, {
      headers: { "Content-Type": "audio/mpeg" }
    });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

app.get("/media/:image_length/:image_name", MediaMiddleware, async (c) => {
  try {
    const name = c.req.param("image_name");
    const image_length = c.req.param("image_length").replace(/_\d+_\d+/g, "");

    const response = await fetch(`${BASE_URL}/media/${image_length}/${name}`, {
      method: "GET",
      headers: {
        "User-Agent": c.req.header("User-Agent") || "Proxy-Server",
        "Referer": BASE_URL,
      },
    });
    if (!response.ok) {
      return new Response(`Failed to fetch image: ${response.status}`, { status: response.status });
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": response.headers.get("content-type") || "image/jpeg",
      },
    });
  } catch (error) {
    return new Response(`Error fetching media: ${error}`, { status: 500 });
  }
});


export default app;
