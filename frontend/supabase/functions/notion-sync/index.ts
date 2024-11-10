import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface NotionProperty {
  [key: string]: unknown;
}

interface NotionPage {
  id: string;
  properties: NotionProperty;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const notionToken = Deno.env.get("NOTION_API_TOKEN");
    const notionDatabaseId = Deno.env.get("NOTION_DATABASE_ID");

    if (!notionToken || !notionDatabaseId) {
      throw new Error(
        "Missing Notion configuration: NOTION_API_TOKEN and NOTION_DATABASE_ID required"
      );
    }

    // Fetch pages from Notion
    const notionResponse = await fetch(
      `https://api.notion.com/v1/databases/${notionDatabaseId}/query`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${notionToken}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );

    if (!notionResponse.ok) {
      throw new Error(
        `Failed to fetch from Notion: ${notionResponse.status} ${notionResponse.statusText}`
      );
    }

    const notionData = await notionResponse.json();
    const pages = notionData.results as NotionPage[];

    // Transform Notion data to match your blog schema
    const blogPosts = pages.map((page) => {
      const props = page.properties;

      return {
        notion_id: page.id,
        title: extractTitle(props),
        excerpt: extractExcerpt(props),
        content: extractContent(props),
        author: extractAuthor(props),
        date: extractDate(props),
        read_time: "5 min read", // Calculate or fetch from Notion
        category: extractCategory(props),
        image: extractImage(props),
        tags: extractTags(props),
        featured: extractFeatured(props),
      };
    });

    // Upsert into Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabaseResponse = await fetch(
      `${supabaseUrl}/rest/v1/blog_posts`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates",
        },
        body: JSON.stringify(blogPosts),
      }
    );

    if (!supabaseResponse.ok) {
      throw new Error(
        `Failed to sync to Supabase: ${supabaseResponse.status} ${supabaseResponse.statusText}`
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced: blogPosts.length,
        message: `Successfully synced ${blogPosts.length} posts from Notion`,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});

// Helper functions to extract data from Notion properties
function extractTitle(props: NotionProperty): string {
  const titleProp = props.Title || props.title;
  if (titleProp && typeof titleProp === "object" && "title" in titleProp) {
    const titleArray = titleProp.title as Array<{ plain_text: string }>;
    return titleArray[0]?.plain_text || "Untitled";
  }
  return "Untitled";
}

function extractExcerpt(props: NotionProperty): string {
  const excerptProp = props.Excerpt || props.excerpt;
  if (excerptProp && typeof excerptProp === "object" && "rich_text" in excerptProp) {
    const richText = excerptProp.rich_text as Array<{ plain_text: string }>;
    return richText[0]?.plain_text || "";
  }
  return "";
}

function extractContent(props: NotionProperty): string {
  const contentProp = props.Content || props.content;
  if (contentProp && typeof contentProp === "object" && "rich_text" in contentProp) {
    const richText = contentProp.rich_text as Array<{ plain_text: string }>;
    return richText.map((t) => t.plain_text).join("\n");
  }
  return "";
}

function extractAuthor(props: NotionProperty): string {
  const authorProp = props.Author || props.author;
  if (authorProp && typeof authorProp === "object" && "rich_text" in authorProp) {
    const richText = authorProp.rich_text as Array<{ plain_text: string }>;
    return richText[0]?.plain_text || "Anonymous";
  }
  return "Anonymous";
}

function extractDate(props: NotionProperty): string {
  const dateProp = props.Date || props.date;
  if (dateProp && typeof dateProp === "object" && "date" in dateProp) {
    const date = (dateProp.date as { start?: string }).start;
    return date || new Date().toISOString();
  }
  return new Date().toISOString();
}

function extractCategory(props: NotionProperty): string {
  const categoryProp = props.Category || props.category;
  if (categoryProp && typeof categoryProp === "object" && "select" in categoryProp) {
    const select = (categoryProp.select as { name?: string });
    return select.name || "General";
  }
  return "General";
}

function extractImage(props: NotionProperty): string {
  const imageProp = props.Image || props.image;
  if (imageProp && typeof imageProp === "object" && "files" in imageProp) {
    const files = imageProp.files as Array<{ file?: { url: string }; external?: { url: string } }>;
    if (files[0]?.file?.url) return files[0].file.url;
    if (files[0]?.external?.url) return files[0].external.url;
  }
  return "";
}

function extractTags(props: NotionProperty): string[] {
  const tagsProp = props.Tags || props.tags;
  if (tagsProp && typeof tagsProp === "object" && "multi_select" in tagsProp) {
    const multiSelect = tagsProp.multi_select as Array<{ name: string }>;
    return multiSelect.map((t) => t.name);
  }
  return [];
}

function extractFeatured(props: NotionProperty): boolean {
  const featuredProp = props.Featured || props.featured;
  if (featuredProp && typeof featuredProp === "object" && "checkbox" in featuredProp) {
    return (featuredProp.checkbox as boolean) || false;
  }
  return false;
}
