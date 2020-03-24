# SyncDex

**SyncDex** update your manga list on many services when you read on [MangaDex](https://mangadex.org/).

You can update your list on this services:

![MyAnimeList Icon](/icons/mal.png) MyAnimeList ([https://myanimelist.net/panel.php]())  
![Anilist Icon](/icons/al.png) Anilist ([https://anilist.co/home]())  
![MangaUpdates Icon](/icons/mu.png) MangaUpdates ([https://www.mangaupdates.com/index.html]())  
![Kitsu Icon](/icons/ku.png) Kitsu ([https://kitsu.io/]())  
![Anime Planet Icon](/icons/ap.png) Anime Planet ([https://www.anime-planet.com/]())

// Look at *proxer.me*, *shikimori.one*, *anisearch.com*

## Data

The least amount of data is stored, here is the list of data for *each* titles on MangaDex:

```Javascript
{
    mangaDexId: {
        services: {
            mal: 0, // MyAnimeList
            al: 0, // Anilist
            ku: 0, // Kitsu
            mu: 0, // MangaUpdates
            ap: 0, // Anime Planet
        },
        progress: 0, // The last read chapter on MangaDex
        lastCheck: Date.now(), // The last time nikurasu.org was queried for this title
        // The saved state of the title when some services are missing
        waiting: {
            start: Date.now(),
            end: Date.now(),
            status: 'READING',
        }
        chapters: [], // The list of the last X opened chapters
    }
}
```

``waiting`` is only saved when at least 1 service doesn't have an entry for the title, it will be used and deleted when the title is finally added on a service.

## TODO

- [x] Router
- Services
  - Parse Service response
    - [ ] MyAnimeList
    - [ ] Anilist
    - [ ] MangaUpdates
    - [ ] Kitsu
    - [ ] Anime Planet
  - Update single entry
    - [ ] MyAnimeList
    - [ ] Anilist
    - [ ] MangaUpdates
    - [ ] Kitsu
    - [ ] Anime Planet
- [ ] Display service in Title Page
- [ ] Highlight Chapter List/Title List pages
- [ ] Thumbnails
- [ ] Options
- [ ] Import/Export
- [ ] Bigger History
