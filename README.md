# SyncDex

**SyncDex** update your manga list on many services when you read on [MangaDex](https://mangadex.org/).

You can update your list on this services:

![MyAnimeList Icon](icons/mal.png) MyAnimeList ([https://myanimelist.net/panel.php]())  
![Anilist Icon](icons/al.png) Anilist ([https://anilist.co/home]())  
![Kitsu Icon](icons/ku.png) Kitsu ([https://kitsu.io/]())  
![MangaUpdates Icon](icons/mu.png) MangaUpdates ([https://www.mangaupdates.com/index.html]())  
![Anime Planet Icon](icons/ap.png) Anime Planet ([https://www.anime-planet.com/]())

## Build

You need to have **Node.js** and **npm** installed, initialize with ``npm install`` and run ``node build`` to build **SyncDex** in the **build** folder.  
There will be one subfolder for each platforms (Firefox and Chrome).

You can pass some options:

* ``--web-ext``: Build the ``web-ext`` archives.
* ``-mode dev|prod``: Currently only minify code in ``prod`` mode.
* ``--watch``: Watch all modules and re-compile on update.