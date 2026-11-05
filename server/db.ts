import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { VERIFIED_COURSES } from './verifiedCourses';
import { hashPassword } from './auth';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'fairway.db');
export const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      handicap REAL,
      home_city TEXT,
      home_state TEXT,
      is_demo_user INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      subtitle TEXT,
      region_tag TEXT NOT NULL,
      street_address TEXT,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      zip TEXT,
      country TEXT NOT NULL DEFAULT 'US',
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      phone TEXT,
      website_url TEXT,
      booking_url TEXT,
      google_maps_url TEXT NOT NULL,
      access_type TEXT NOT NULL DEFAULT 'Public',
      holes INTEGER DEFAULT 18,
      par INTEGER,
      yardage INTEGER,
      course_style TEXT,
      architect TEXT,
      year_built INTEGER,
      turf_greens TEXT,
      turf_fairways TEXT,
      green_fee_min INTEGER,
      green_fee_max INTEGER,
      green_fee_notes TEXT,
      amenities_json TEXT,
      official_description TEXT,
      data_source TEXT NOT NULL,
      verified_at TEXT NOT NULL,
      created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS condition_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      report_type TEXT NOT NULL CHECK (report_type IN ('quick', 'detailed')),
      overall_rating REAL NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 10),
      greens_rating REAL CHECK (greens_rating IS NULL OR (greens_rating >= 1 AND greens_rating <= 10)),
      fairways_rating REAL CHECK (fairways_rating IS NULL OR (fairways_rating >= 1 AND fairways_rating <= 10)),
      bunkers_rating REAL CHECK (bunkers_rating IS NULL OR (bunkers_rating >= 1 AND bunkers_rating <= 10)),
      rough_rating REAL CHECK (rough_rating IS NULL OR (rough_rating >= 1 AND rough_rating <= 10)),
      tee_boxes_rating REAL CHECK (tee_boxes_rating IS NULL OR (tee_boxes_rating >= 1 AND tee_boxes_rating <= 10)),
      green_speed TEXT,
      firmness TEXT,
      aeration_status TEXT,
      pace_minutes INTEGER,
      pin_conditions_note TEXT,
      comment TEXT,
      played_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      is_demo INTEGER NOT NULL DEFAULT 0,
      flag_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS report_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL REFERENCES condition_reports(id) ON DELETE CASCADE,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      caption TEXT,
      area_tag TEXT NOT NULL DEFAULT 'General',
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS report_helpful_votes (
      report_id INTEGER NOT NULL REFERENCES condition_reports(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (report_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS report_flags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL REFERENCES condition_reports(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL,
      UNIQUE (report_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS user_favorites (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, course_id)
    );

    CREATE TABLE IF NOT EXISTS course_follows (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      last_seen_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, course_id)
    );

    CREATE INDEX IF NOT EXISTS idx_courses_state_city ON courses(state, city);
    CREATE INDEX IF NOT EXISTS idx_reports_course_created ON condition_reports(course_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_reports_created ON condition_reports(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_photos_course_created ON report_photos(course_id, created_at DESC);
  `);

  seedVerifiedCoursesAndDemoBaseline();
}

function buildGoogleMapsUrl(name: string, street: string, city: string, state: string, zip: string): string {
  const query = encodeURIComponent(`${name}, ${street}, ${city}, ${state} ${zip}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function seedVerifiedCoursesAndDemoBaseline(): void {
  const existingCountRow = db.prepare('SELECT COUNT(*) as cnt FROM courses').get() as { cnt: number };
  if (existingCountRow.cnt > 0) {
    return;
  }

  const now = Date.now();
  const isoAgoHours = (h: number) => new Date(now - h * 3600 * 1000).toISOString();
  const dateOnlyAgoHours = (h: number) => new Date(now - h * 3600 * 1000).toISOString().slice(0, 10);

  const insertCourse = db.prepare(`
    INSERT INTO courses (
      slug, name, subtitle, region_tag, street_address, city, state, zip, country,
      latitude, longitude, phone, website_url, booking_url, google_maps_url,
      access_type, holes, par, yardage, course_style, architect, year_built,
      turf_greens, turf_fairways, green_fee_min, green_fee_max, green_fee_notes,
      amenities_json, official_description, data_source, verified_at, created_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )
  `);

  const courseIdBySlug = new Map<string, number>();
  const verifiedIso = new Date(now).toISOString();

  for (const c of VERIFIED_COURSES) {
    const gmapsUrl = buildGoogleMapsUrl(c.name, c.streetAddress, c.city, c.state, c.zip);
    const res = insertCourse.run(
      c.slug,
      c.name,
      c.subtitle,
      c.regionTag,
      c.streetAddress,
      c.city,
      c.state,
      c.zip,
      c.country,
      c.latitude,
      c.longitude,
      c.phone,
      c.websiteUrl,
      c.bookingUrl,
      gmapsUrl,
      c.accessType,
      c.holes,
      c.par,
      c.yardage,
      c.courseStyle,
      c.architect,
      c.yearBuilt,
      c.turfGreens,
      c.turfFairways,
      c.greenFeeMin,
      c.greenFeeMax,
      c.greenFeeNotes,
      c.amenities ? JSON.stringify(c.amenities) : null,
      c.officialDescription,
      c.dataSource,
      verifiedIso,
      verifiedIso
    );
    courseIdBySlug.set(c.slug, Number(res.lastInsertRowid));
  }

  // Create clearly labeled Demonstration Reviewer profiles so baseline reports are unmistakably identified
  const demoPw = hashPassword('FairwayDemo!2026');
  const insertUser = db.prepare(`
    INSERT INTO users (email, name, username, password_hash, password_salt, handicap, home_city, home_state, is_demo_user, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `);

  const u1 = Number(
    insertUser.run(
      'demo.marcus@fairway.example',
      'Marcus Vance (Sample)',
      'marcus_midatlantic',
      demoPw.hash,
      demoPw.salt,
      3.4,
      'Baltimore',
      'MD',
      isoAgoHours(24 * 60)
    ).lastInsertRowid
  );
  const u2 = Number(
    insertUser.run(
      'demo.elena@fairway.example',
      'Elena Rostova (Sample)',
      'elena_links',
      demoPw.hash,
      demoPw.salt,
      6.8,
      'Towson',
      'MD',
      isoAgoHours(24 * 55)
    ).lastInsertRowid
  );
  const u3 = Number(
    insertUser.run(
      'demo.grant@fairway.example',
      'Grant Holloway (Sample)',
      'grant_turf',
      demoPw.hash,
      demoPw.salt,
      1.2,
      'Annapolis',
      'MD',
      isoAgoHours(24 * 50)
    ).lastInsertRowid
  );
  const u4 = Number(
    insertUser.run(
      'demo.devon@fairway.example',
      'Devon Brooks (Sample)',
      'devon_walker',
      demoPw.hash,
      demoPw.salt,
      11.5,
      'San Diego',
      'CA',
      isoAgoHours(24 * 45)
    ).lastInsertRowid
  );

  const insertReport = db.prepare(`
    INSERT INTO condition_reports (
      course_id, user_id, report_type, overall_rating,
      greens_rating, fairways_rating, bunkers_rating, rough_rating, tee_boxes_rating,
      green_speed, firmness, aeration_status, pace_minutes, pin_conditions_note,
      comment, played_at, created_at, is_demo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const insertPhoto = db.prepare(`
    INSERT INTO report_photos (report_id, course_id, user_id, url, caption, area_tag, is_demo, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `);

  interface DemoReportSeed {
    slug: string;
    userId: number;
    type: 'quick' | 'detailed';
    hoursAgo: number;
    overall: number;
    greens?: number | null;
    fairways?: number | null;
    bunkers?: number | null;
    rough?: number | null;
    tees?: number | null;
    speed?: string | null;
    firmness?: string | null;
    aeration?: string | null;
    pace?: number | null;
    comment: string;
    photo?: { url: string; caption: string; areaTag: string };
  }

  const demoReports: DemoReportSeed[] = [
    // 1. Bulle Rock — Consistent high-confidence championship conditions
    {
      slug: 'bulle-rock-golf-course',
      userId: u3,
      type: 'detailed',
      hoursAgo: 5,
      overall: 9.5,
      greens: 9.5,
      fairways: 9.5,
      bunkers: 9.0,
      rough: 9.0,
      tees: 9.5,
      speed: 'Tournament',
      firmness: 'Firm',
      aeration: 'None',
      pace: 255,
      comment:
        '[Demonstration Sample] Bentgrass greens rolled pure at morning dew cut—zero poa bump and crisp edges around every greenside bunker on the back nine.',
      photo: {
        url: '/demo-photos/green-pure-bentgrass.jpg',
        caption: 'Sample illustration: Morning mowing stripes and greenside bunker conditioning',
        areaTag: 'Greens',
      },
    },
    {
      slug: 'bulle-rock-golf-course',
      userId: u1,
      type: 'detailed',
      hoursAgo: 78,
      overall: 9.2,
      greens: 9.5,
      fairways: 9.0,
      bunkers: 9.0,
      rough: 9.0,
      tees: 9.0,
      speed: 'Fast',
      firmness: 'Firm',
      aeration: 'None',
      pace: 265,
      comment:
        '[Demonstration Sample] Fairways are tightly knit with great roll-out. Bunkers were freshly raked with consistent sand depth.',
    },
    {
      slug: 'bulle-rock-golf-course',
      userId: u2,
      type: 'quick',
      hoursAgo: 24 * 11,
      overall: 9.0,
      speed: 'Fast',
      firmness: 'Medium',
      aeration: 'None',
      comment: '[Demonstration Sample] Tour-grade turf tee to green. Worth the drive up I-95.',
    },
    {
      slug: 'bulle-rock-golf-course',
      userId: u4,
      type: 'detailed',
      hoursAgo: 24 * 22,
      overall: 9.1,
      greens: 9.0,
      fairways: 9.5,
      bunkers: 8.5,
      rough: 9.0,
      tees: 9.0,
      speed: 'Fast',
      firmness: 'Medium',
      aeration: 'None',
      pace: 260,
      comment: '[Demonstration Sample] Excellent late-season turf density across all 18 holes.',
    },

    // 2. Pine Ridge (Baltimore) — Classic Improving Trend! Recovering from aeration 19 days ago -> pure today
    {
      slug: 'pine-ridge-golf-course-md',
      userId: u1,
      type: 'detailed',
      hoursAgo: 14,
      overall: 8.7,
      greens: 8.8,
      fairways: 8.5,
      bunkers: 8.0,
      rough: 8.5,
      tees: 8.5,
      speed: 'Fast',
      firmness: 'Medium',
      aeration: 'None',
      pace: 260,
      comment:
        '[Demonstration Sample] Greens have completely healed from last month’s punch! Rolling smooth and holding approach shots along the watershed holes.',
      photo: {
        url: '/demo-photos/fairway-bunker-condition.jpg',
        caption: 'Sample illustration: Recovered fairway and approach apron definition',
        areaTag: 'Fairways',
      },
    },
    {
      slug: 'pine-ridge-golf-course-md',
      userId: u2,
      type: 'detailed',
      hoursAgo: 24 * 8,
      overall: 7.4,
      greens: 7.0,
      fairways: 8.0,
      bunkers: 7.5,
      rough: 8.0,
      tees: 7.5,
      speed: 'Medium',
      firmness: 'Medium',
      aeration: 'Healing / Topdressed',
      pace: 270,
      comment:
        '[Demonstration Sample] Light sand still visible in tiny tine marks on a few shaded greens, about 80% healed and much better than last week.',
    },
    {
      slug: 'pine-ridge-golf-course-md',
      userId: u3,
      type: 'detailed',
      hoursAgo: 24 * 18,
      overall: 5.6,
      greens: 4.5,
      fairways: 7.5,
      bunkers: 7.0,
      rough: 7.5,
      tees: 7.0,
      speed: 'Slow',
      firmness: 'Soft',
      aeration: 'Recently Punched',
      pace: 250,
      comment:
        '[Demonstration Sample] Heads up—greens were core aerated and heavily topdressed earlier this week. Fairways are fine, but putts are bumpy until sand settles.',
      photo: {
        url: '/demo-photos/green-aerated-topdress.jpg',
        caption: 'Sample illustration: Core aeration and sand topdressing 18 days ago',
        areaTag: 'Greens',
      },
    },

    // 3. Worthington Manor — Classic Declining Trend! Historically great (9.0), just punched greens yesterday (5.5)!
    {
      slug: 'worthington-manor-golf-club',
      userId: u3,
      type: 'detailed',
      hoursAgo: 19,
      overall: 5.5,
      greens: 4.0,
      fairways: 8.5,
      bunkers: 8.5,
      rough: 8.5,
      tees: 8.0,
      speed: 'Slow',
      firmness: 'Soft',
      aeration: 'Recently Punched',
      pace: 245,
      comment:
        '[Demonstration Sample] Maintenance alert: A-4 bentgrass greens were just punched and sanded yesterday. Rest of the layout (fairways and bunkers) is an 8.5+, so give greens ~12 days to heal.',
    },
    {
      slug: 'worthington-manor-golf-club',
      userId: u1,
      type: 'detailed',
      hoursAgo: 24 * 12,
      overall: 8.9,
      greens: 9.2,
      fairways: 8.8,
      bunkers: 8.5,
      rough: 8.8,
      tees: 8.5,
      speed: 'Tournament',
      firmness: 'Firm',
      aeration: 'None',
      pace: 265,
      comment: '[Demonstration Sample] Lightning-quick greens prior to scheduled maintenance.',
    },
    {
      slug: 'worthington-manor-golf-club',
      userId: u2,
      type: 'detailed',
      hoursAgo: 24 * 21,
      overall: 9.0,
      greens: 9.3,
      fairways: 8.8,
      bunkers: 8.8,
      rough: 8.5,
      tees: 8.8,
      speed: 'Tournament',
      firmness: 'Firm',
      aeration: 'None',
      pace: 260,
      comment: '[Demonstration Sample] USGA-caliber green speed and crisp bunkering.',
    },

    // 4. Whiskey Creek — Strong Good/Excellent steady conditions
    {
      slug: 'whiskey-creek-golf-club',
      userId: u2,
      type: 'detailed',
      hoursAgo: 28,
      overall: 9.1,
      greens: 9.2,
      fairways: 9.0,
      bunkers: 8.8,
      rough: 9.0,
      tees: 9.0,
      speed: 'Fast',
      firmness: 'Firm',
      aeration: 'None',
      pace: 270,
      comment:
        '[Demonstration Sample] Elevation holes drained great after midweek rain. Greens rolled true around 11 on the stimp.',
    },
    {
      slug: 'whiskey-creek-golf-club',
      userId: u1,
      type: 'detailed',
      hoursAgo: 24 * 9,
      overall: 8.9,
      greens: 9.0,
      fairways: 9.0,
      bunkers: 8.5,
      rough: 8.8,
      tees: 8.8,
      speed: 'Fast',
      firmness: 'Medium',
      aeration: 'None',
      pace: 265,
      comment: '[Demonstration Sample] Plush bentgrass fairways and clean tee boxes on the par 3s.',
    },
    {
      slug: 'whiskey-creek-golf-club',
      userId: u3,
      type: 'quick',
      hoursAgo: 24 * 19,
      overall: 9.0,
      speed: 'Fast',
      firmness: 'Firm',
      aeration: 'None',
      comment: '[Demonstration Sample] Top-tier conditioning across all 18 holes.',
    },

    // 5. Greystone Golf Course — Solid municipal standout
    {
      slug: 'greystone-golf-course',
      userId: u1,
      type: 'detailed',
      hoursAgo: 36,
      overall: 8.4,
      greens: 8.5,
      fairways: 8.5,
      bunkers: 7.8,
      rough: 8.5,
      tees: 8.0,
      speed: 'Fast',
      firmness: 'Medium',
      aeration: 'None',
      pace: 275,
      comment:
        '[Demonstration Sample] Best public value in northern Baltimore County right now. Greens are smooth; two fairway bunkers had compacted wet sand after rain.',
    },
    {
      slug: 'greystone-golf-course',
      userId: u2,
      type: 'detailed',
      hoursAgo: 24 * 10,
      overall: 8.2,
      greens: 8.5,
      fairways: 8.2,
      bunkers: 7.5,
      rough: 8.2,
      tees: 8.0,
      speed: 'Medium',
      firmness: 'Medium',
      aeration: 'None',
      pace: 270,
      comment: '[Demonstration Sample] Very clean lies in the fairways and consistent green speeds.',
    },

    // 6. Mount Pleasant Golf Course — Solid Baltimore city classic
    {
      slug: 'mount-pleasant-golf-course',
      userId: u2,
      type: 'detailed',
      hoursAgo: 44,
      overall: 7.9,
      greens: 8.2,
      fairways: 7.8,
      bunkers: 7.2,
      rough: 8.0,
      tees: 7.5,
      speed: 'Medium',
      firmness: 'Medium',
      aeration: 'None',
      pace: 265,
      comment:
        '[Demonstration Sample] Greens are rolling surprisingly quick and smooth. Par-3 tee boxes show a little divot wear from weekend play.',
    },
    {
      slug: 'mount-pleasant-golf-course',
      userId: u1,
      type: 'quick',
      hoursAgo: 24 * 13,
      overall: 7.8,
      speed: 'Medium',
      firmness: 'Medium',
      aeration: 'None',
      comment: '[Demonstration Sample] Good municipal shape—greens are the highlight.',
    },

    // 7. Rocky Point Golf Course — Average / Good municipal waterfront
    {
      slug: 'rocky-point-golf-course',
      userId: u1,
      type: 'detailed',
      hoursAgo: 24 * 4,
      overall: 7.3,
      greens: 7.5,
      fairways: 7.2,
      bunkers: 6.8,
      rough: 7.5,
      tees: 7.2,
      speed: 'Medium',
      firmness: 'Medium',
      aeration: 'None',
      pace: 260,
      comment:
        '[Demonstration Sample] Breezy bay holes played firm. Greens are healthy; bayside bunkers could use fresh sand.',
    },
    {
      slug: 'rocky-point-golf-course',
      userId: u3,
      type: 'quick',
      hoursAgo: 24 * 16,
      overall: 7.1,
      speed: 'Medium',
      firmness: 'Firm',
      aeration: 'None',
      comment: '[Demonstration Sample] Solid municipal round overlooking Back River.',
    },

    // 8. Waverly Woods — Intentionally 1 single recent report to demonstrate "Limited Recent Data" handling!
    {
      slug: 'waverly-woods-golf-club',
      userId: u2,
      type: 'detailed',
      hoursAgo: 24 * 6,
      overall: 8.1,
      greens: 8.5,
      fairways: 8.0,
      bunkers: 7.5,
      rough: 8.0,
      tees: 8.0,
      speed: 'Fast',
      firmness: 'Medium',
      aeration: 'None',
      pace: 275,
      comment:
        '[Demonstration Sample] Smooth greens through the wooded back nine. Single recent report—needs a second golfer confirmation.',
    },

    // 9. Clifton Park — Intentionally STALE (>30 days old) so Fairway demonstrates refusing to show stale data as current!
    {
      slug: 'clifton-park-golf-course',
      userId: u1,
      type: 'detailed',
      hoursAgo: 24 * 39,
      overall: 7.6,
      greens: 7.8,
      fairways: 7.5,
      bunkers: 7.0,
      rough: 7.5,
      tees: 7.2,
      speed: 'Medium',
      firmness: 'Medium',
      aeration: 'None',
      pace: 255,
      comment:
        '[Demonstration Sample] Older report from over five weeks ago—current conditions require a fresh update.',
    },

    // Note: Lake Presidential intentionally has 0 reports to demonstrate the clean "Awaiting First Report" state!

    // National Iconic Courses
    {
      slug: 'pebble-beach-golf-links',
      userId: u4,
      type: 'detailed',
      hoursAgo: 9,
      overall: 9.6,
      greens: 9.5,
      fairways: 9.8,
      bunkers: 9.7,
      rough: 9.5,
      tees: 9.6,
      speed: 'Fast',
      firmness: 'Firm',
      aeration: 'None',
      pace: 295,
      comment:
        '[Demonstration Sample] Morning Poa greens rolled pure before afternoon marine breeze picked up. Fairways along Carmel Bay are immaculate.',
    },
    {
      slug: 'pebble-beach-golf-links',
      userId: u3,
      type: 'detailed',
      hoursAgo: 24 * 6,
      overall: 9.5,
      greens: 9.3,
      fairways: 9.7,
      bunkers: 9.6,
      rough: 9.5,
      tees: 9.5,
      speed: 'Fast',
      firmness: 'Firm',
      aeration: 'None',
      pace: 290,
      comment: '[Demonstration Sample] Championship presentation on every tee, bunker, and collar.',
    },
    {
      slug: 'bandon-dunes-golf-course',
      userId: u4,
      type: 'detailed',
      hoursAgo: 18,
      overall: 9.4,
      greens: 9.2,
      fairways: 9.6,
      bunkers: 9.3,
      rough: 9.4,
      tees: 9.4,
      speed: 'Medium',
      firmness: 'Firm',
      aeration: 'None',
      pace: 250,
      comment:
        '[Demonstration Sample] Tight, bouncy fescue fairways allowing true ground-game approaches along the bluff.',
      photo: {
        url: '/demo-photos/links-firm-turf.jpg',
        caption: 'Sample illustration: Firm coastal fescue turf and natural bunkering',
        areaTag: 'Fairways',
      },
    },
    {
      slug: 'bandon-dunes-golf-course',
      userId: u3,
      type: 'quick',
      hoursAgo: 24 * 7,
      overall: 9.3,
      speed: 'Medium',
      firmness: 'Firm',
      aeration: 'None',
      comment: '[Demonstration Sample] Pure links turf and effortless 4h10m walking pace.',
    },
    {
      slug: 'pinehurst-no-2',
      userId: u3,
      type: 'detailed',
      hoursAgo: 22,
      overall: 9.5,
      greens: 9.7,
      fairways: 9.4,
      bunkers: 9.4,
      rough: 9.3,
      tees: 9.5,
      speed: 'Tournament',
      firmness: 'Firm',
      aeration: 'None',
      pace: 265,
      comment:
        '[Demonstration Sample] Champion Ultradwarf greens are firm, baked to perfection around the turtleback crowns, and rolling fast.',
    },
    {
      slug: 'pinehurst-no-2',
      userId: u1,
      type: 'detailed',
      hoursAgo: 24 * 8,
      overall: 9.4,
      greens: 9.6,
      fairways: 9.3,
      bunkers: 9.3,
      rough: 9.2,
      tees: 9.4,
      speed: 'Tournament',
      firmness: 'Firm',
      aeration: 'None',
      pace: 270,
      comment: '[Demonstration Sample] Native sandy waste areas and aprons are tight and spotless.',
    },
    {
      slug: 'tobacco-road-golf-club',
      userId: u1,
      type: 'detailed',
      hoursAgo: 24 * 3,
      overall: 8.8,
      greens: 9.0,
      fairways: 8.8,
      bunkers: 8.5,
      rough: 8.7,
      tees: 8.6,
      speed: 'Fast',
      firmness: 'Firm',
      aeration: 'None',
      pace: 275,
      comment: '[Demonstration Sample] TifEagle greens are dialled in and sandy waste areas played clean.',
    },
    {
      slug: 'tobacco-road-golf-club',
      userId: u2,
      type: 'quick',
      hoursAgo: 24 * 12,
      overall: 8.6,
      speed: 'Fast',
      firmness: 'Firm',
      aeration: 'None',
      comment: '[Demonstration Sample] Great Sandhills conditioning.',
    },
    {
      slug: 'torrey-pines-south-course',
      userId: u4,
      type: 'detailed',
      hoursAgo: 31,
      overall: 8.6,
      greens: 8.5,
      fairways: 8.8,
      bunkers: 8.4,
      rough: 8.8,
      tees: 8.3,
      speed: 'Fast',
      firmness: 'Medium',
      aeration: 'None',
      pace: 285,
      comment:
        '[Demonstration Sample] Thick Kikuyu rough is penal right off the fairway cut; Poa greens held lines well through the morning.',
    },
    {
      slug: 'torrey-pines-south-course',
      userId: u3,
      type: 'quick',
      hoursAgo: 24 * 11,
      overall: 8.5,
      speed: 'Fast',
      firmness: 'Medium',
      aeration: 'None',
      comment: '[Demonstration Sample] Strong municipal championship turf.',
    },
    {
      slug: 'bethpage-state-park-black-course',
      userId: u1,
      type: 'detailed',
      hoursAgo: 40,
      overall: 8.9,
      greens: 9.0,
      fairways: 9.0,
      bunkers: 8.6,
      rough: 9.2,
      tees: 8.7,
      speed: 'Fast',
      firmness: 'Firm',
      aeration: 'None',
      pace: 280,
      comment:
        '[Demonstration Sample] Deep primary rough and crisp fairway edges. Walking-only turf holds up remarkably well.',
    },
    {
      slug: 'bethpage-state-park-black-course',
      userId: u2,
      type: 'quick',
      hoursAgo: 24 * 9,
      overall: 8.8,
      speed: 'Fast',
      firmness: 'Firm',
      aeration: 'None',
      comment: '[Demonstration Sample] Pure Tillinghast bunkering and fast greens.',
    },
    {
      slug: 'tpc-sawgrass-stadium-course',
      userId: u3,
      type: 'detailed',
      hoursAgo: 24 * 2,
      overall: 9.3,
      greens: 9.5,
      fairways: 9.3,
      bunkers: 9.2,
      rough: 9.1,
      tees: 9.4,
      speed: 'Tournament',
      firmness: 'Firm',
      aeration: 'None',
      pace: 270,
      comment: '[Demonstration Sample] Immaculate overseed transition and razor-clean collars around 16, 17, and 18.',
    },
    {
      slug: 'tpc-sawgrass-stadium-course',
      userId: u4,
      type: 'quick',
      hoursAgo: 24 * 10,
      overall: 9.2,
      speed: 'Tournament',
      firmness: 'Firm',
      aeration: 'None',
      comment: '[Demonstration Sample] Every lie feels teed up.',
    },
    {
      slug: 'troon-north-monument-course',
      userId: u4,
      type: 'detailed',
      hoursAgo: 16,
      overall: 9.0,
      greens: 9.1,
      fairways: 9.2,
      bunkers: 8.7,
      rough: 8.8,
      tees: 9.0,
      speed: 'Fast',
      firmness: 'Medium',
      aeration: 'None',
      pace: 265,
      comment: '[Demonstration Sample] Lush emerald ryegrass fairways contrasting against the desert washes.',
    },
    {
      slug: 'troon-north-monument-course',
      userId: u2,
      type: 'quick',
      hoursAgo: 24 * 14,
      overall: 8.7,
      speed: 'Fast',
      firmness: 'Medium',
      aeration: 'None',
      comment: '[Demonstration Sample] Post-overseed rye is fully established and playing great.',
    },
    {
      slug: 'tpc-scottsdale-stadium-course',
      userId: u4,
      type: 'detailed',
      hoursAgo: 24 * 3,
      overall: 9.1,
      greens: 9.2,
      fairways: 9.2,
      bunkers: 9.0,
      rough: 8.9,
      tees: 9.0,
      speed: 'Fast',
      firmness: 'Firm',
      aeration: 'None',
      pace: 270,
      comment: '[Demonstration Sample] Crisp post-overseed striping and smooth putting surfaces.',
    },
    {
      slug: 'whistling-straits-straits-course',
      userId: u3,
      type: 'detailed',
      hoursAgo: 24 * 5,
      overall: 9.2,
      greens: 9.3,
      fairways: 9.2,
      bunkers: 9.0,
      rough: 9.1,
      tees: 9.2,
      speed: 'Fast',
      firmness: 'Firm',
      aeration: 'None',
      pace: 275,
      comment: '[Demonstration Sample] Firm Lake Michigan fescue turf and immaculate greens.',
    },
    {
      slug: 'whistling-straits-straits-course',
      userId: u1,
      type: 'quick',
      hoursAgo: 24 * 15,
      overall: 9.1,
      speed: 'Fast',
      firmness: 'Firm',
      aeration: 'None',
      comment: '[Demonstration Sample] Championship links conditioning.',
    },
  ];

  for (const r of demoReports) {
    const courseId = courseIdBySlug.get(r.slug);
    if (!courseId) continue;
    const createdIso = isoAgoHours(r.hoursAgo);
    const playedDate = dateOnlyAgoHours(r.hoursAgo);
    const res = insertReport.run(
      courseId,
      r.userId,
      r.type,
      r.overall,
      r.greens ?? null,
      r.fairways ?? null,
      r.bunkers ?? null,
      r.rough ?? null,
      r.tees ?? null,
      r.speed ?? null,
      r.firmness ?? null,
      r.aeration ?? null,
      r.pace ?? null,
      null,
      r.comment,
      playedDate,
      createdIso
    );
    const reportId = Number(res.lastInsertRowid);
    if (r.photo) {
      insertPhoto.run(
        reportId,
        courseId,
        r.userId,
        r.photo.url,
        r.photo.caption,
        r.photo.areaTag,
        createdIso
      );
    }
  }
}
