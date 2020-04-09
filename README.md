# SyncDex

**SyncDex** update your manga list on many services when you read on [MangaDex](https://mangadex.org/).

You can update your list on this services:

![MyAnimeList Icon](/icons/mal.png) MyAnimeList ([https://myanimelist.net/panel.php]())  
![Anilist Icon](/icons/al.png) Anilist ([https://anilist.co/home]())  
![MangaUpdates Icon](/icons/mu.png) MangaUpdates ([https://www.mangaupdates.com/index.html]())  
![Kitsu Icon](/icons/ku.png) Kitsu ([https://kitsu.io/]())  
![Anime Planet Icon](/icons/ap.png) Anime Planet ([https://www.anime-planet.com/]())

// Look at *proxer.me*, *shikimori.one*, *anisearch.com*

## Build

You need to have **node** installed, then just run ``node build`` and **SyncDex** will build in the **build** folder.

You can pass some options:

* ``--web-ext``: Build the ``web-ext`` archives.
* ``-mode dev|prod``: Currently only minify code in prod mode.

## Credits

* ``<div>Icons made by <a href="https://www.flaticon.com/authors/becris" title="Becris">Becris</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a></div>``

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
- [x] Highlight Chapter List/Title List pages
- [x] Thumbnails
- [x] Options
	- [x] Load from LocalStorage
	- [ ] Options Page
	- [ ] Import/Export
- [ ] Bigger History
- [x] Build