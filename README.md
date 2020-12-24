# SyncDex

**SyncDex** update your manga list on many Services when you read on [MangaDex](https://mangadex.org/).  
You can also **Import**/**Export** your list between all of these services, to easily get started or switch services.

| ![MyAnimeList Icon](icons/mal.png) MyAnimeList | ![Anilist Icon](icons/al.png) Anilist | ![Kitsu Icon](icons/ku.png) Kitsu | ![MangaUpdates Icon](icons/mu.png) MangaUpdates | ![Anime Planet Icon](icons/ap.png) Anime Planet |
|:---:|:---:|:---:|:---:|:---:|
| [https://myanimelist.net/]() | [https://anilist.co/]() | [https://kitsu.io/]() | [https://www.mangaupdates.com/]() | [https://www.anime-planet.com/]() |

> **SyncDex** is still in beta, expect bugs if you try using it.  
> **Chrome** is always late, use **Firefox** or build your own version.

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/hdlogejanokfcmlbgfdcgnbnpmgdolaa?label=Chrome&logo=google%20chrome&style=for-the-badge)](https://chrome.google.com/webstore/detail/syncdex/hdlogejanokfcmlbgfdcgnbnpmgdolaa)
[![Mozilla Add-on](https://img.shields.io/amo/v/syncdex?label=Firefox&logo=firefox&style=for-the-badge)](https://addons.mozilla.org/en-US/firefox/addon/syncdex/)

## Features

<p align="center" width="100%">
	<img src="screenshots/HighlightPlusCoverPlusActions.png" alt="Follow list" />
</p>

* Sync what you read on **MangaDex**, you can sync to multiple Services at once
* Import/Export to/from any of these services
* Automatically update MangaDex status and score when you start reading/complete a Manga
* Highlight your Follow list to quickly see what you already read, or what is the next chapter
* Hide chapter you already read or chapter that are not your next
* Display the cover of the Manga you hover on in lists
* Group manga in Manga lists by language if you have multiple enabled
* Enhance the History page of **MangaDex** and automatically check if there is new chapters
* Manually update all informations of a Manga and update all Services at once

Most of these options can be customized or disabled if you do not want them !

## MyMangaDex

If you come from **MyMangaDex**, it's not recommended to only import your **MyMangaDex** save, since there was a lot less informations stored, and there will be missing names, score and other informations.  
You should import your save first, and then import from **MyAnimeList**.

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

You need to have **Node.js** and **npm** installed, initialize with ``npm install`` and run ``npm run dev`` to build **SyncDex** in the **build** folder.  
There will be one subfolder for each platforms (Firefox and Chrome).  
You can also run ``npm run watch`` to watch and build on update, or ``npm run build`` to create ``web-ext`` archives.
