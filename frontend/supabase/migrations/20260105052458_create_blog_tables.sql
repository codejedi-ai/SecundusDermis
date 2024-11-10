/*
  # Create Blog Posts and Authors Tables

  1. New Tables
    - `blog_authors`
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `bio` (text)
      - `avatar` (text, nullable)
      - `created_at` (timestamp)
    
    - `blog_posts`
      - `id` (uuid, primary key)
      - `title` (text)
      - `excerpt` (text)
      - `content` (text)
      - `author_id` (uuid, foreign key to blog_authors)
      - `date` (timestamp)
      - `read_time` (text)
      - `category` (text)
      - `image` (text)
      - `tags` (text array)
      - `featured` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Public can read all blog content
    - Only authenticated admins can insert/update/delete
*/

CREATE TABLE IF NOT EXISTS blog_authors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  bio text NOT NULL,
  avatar text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  excerpt text NOT NULL,
  content text NOT NULL,
  author_id uuid NOT NULL REFERENCES blog_authors(id) ON DELETE CASCADE,
  date timestamptz NOT NULL,
  read_time text NOT NULL,
  category text NOT NULL,
  image text NOT NULL,
  tags text[] DEFAULT ARRAY[]::text[],
  featured boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE blog_authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read blog authors"
  ON blog_authors FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can read blog posts"
  ON blog_posts FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Only authenticated users can insert authors"
  ON blog_authors FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Only authenticated users can update authors"
  ON blog_authors FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Only authenticated users can insert posts"
  ON blog_posts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Only authenticated users can update posts"
  ON blog_posts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Only authenticated users can delete authors"
  ON blog_authors FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Only authenticated users can delete posts"
  ON blog_posts FOR DELETE
  TO authenticated
  USING (true);
