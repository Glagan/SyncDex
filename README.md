# SyncDex

**SyncDex** update your manga list on many services when you read on [MangaDex](https://mangadex.org/).

You can update your list on this services:

![MyAnimeList Icon](icons/mal.png) MyAnimeList ([https://myanimelist.net/panel.php]())  
![Anilist Icon](icons/al.png) Anilist ([https://anilist.co/home]())  
![Kitsu Icon](icons/ku.png) Kitsu ([https://kitsu.io/]())  
![MangaUpdates Icon](icons/mu.png) MangaUpdates ([https://www.mangaupdates.com/index.html]())  
![Anime Planet Icon](icons/ap.png) Anime Planet ([https://www.anime-planet.com/]())

## TODO

* [ ] Fix bugs
* [ ] Per container services check in the options
	* Tabs for each containers (if enabled) and status of each services for each containers
	* Save tokens (Anilist, Kitsu) for each containers
* [ ] Better design
* [ ] Original icon
* [ ] Check Brave and Edge
* [ ] Add permissions only when needed

## Support

If you have a bug, open an issue, but if you want to send me a message, check [Support.md](SUPPORT.md).

## Build

You need to have **Node.js** and **npm** installed, initialize with ``npm install`` and run ``node build`` to build **SyncDex** in the **build** folder.  
There will be one subfolder for each platforms (Firefox and Chrome).

You can pass some options:

* ``--web-ext``: Build the ``web-ext`` archives.
* ``--mode=dev|prod``: Currently only minify code in ``prod`` mode.
* ``--watch``: Watch all modules and re-compile on update.