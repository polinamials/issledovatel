---
title: "Publishing to My Hugo Website on the Go with Termux"
date: 2026-08-25
draft: false
summary: "How I use Termux to edit and publish content on this site from my phone."
description: "A guide for installing GitHub and Hugo on Android using the Termux terminal emulator"
tags: ["Dev"]
---

I recently needed to travel for a weekend and didn't feel like bringing my laptop. Having almost finished writing [Part 2](https://issledova.tel/posts/mobstr_part2/) of the Mobstr Logbook, I didn't want to delay publishing it until I could return home to my computer. As a result, I had to figure out a way to do it from my phone.

This website is hosted on GitHub pages and uses the [Hugo](https://gohugo.io/) static website generator. I add new content to it by creating a markdown file in a [GitHub repo](https://github.com/polinamials/issledovatel) and pushing the changes. Last-minute research on the way to the airport showed that I can use the [Termux](https://termux.dev/en/) terminal emulator to recreate the same workflow on my Andoird phone.

Here's how I set it up.

## Apps Needed

Download Termux from the Play Store. You will also need a markdown editor, for example [Zettel Notes](https://www.zettelnotes.com/), but there are numerous other apps available.

## Setup GitHub

First, create an SSH key for GitHub. Open Termux and run the following commands:

```bash
pkg update
pkg upgrade
pkg install git 
```

Installing `git` should also install `openssh`. Generate a new pair of `id_ed25519` keys by running

```bash
ssh-keygen
```

and save the keys to the `~/.ssh` directory. Start the SSH agent:

```bash
sv-enable ssh-agent
```

Add your name and e-mail to Git:

```bash
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
```

Add the public key to GitHub and test your connection by running

```bash
ssh -T git@github.com
```

Once GitHub is set up, you can clone your website's repository in the home directory of the Termux environment:

```bash
git clone git@github.com:<user>/<repo>.git
```

## Install Hugo

Install the Hugo package by running

```bash
pkg install hugo
```

By default, the Termux environment is inaccessible from the rest of the Android file system, so the markdown editor will not be able to access it. Run this command to allow access:

```bash
termux-setup-storage
```

## Setup Markdown Editor

Make sure the markdown editor you're using has access to hidden storage. If you're using Zettel Notes, open the left panel and add a Repository. Give it a name, and click on the folder icon to open the file manager. In the file manager's left panel you should see Termux. Open it, and select your cloned project folder.

That's it! Now you can edit your blog and preview it locally the same way you would on a PC. Simply run 

```bash
hugo server
```

and visit http://localhost:1313 in your mobile browser. 

If you can get over the uncomfortable feeling of doing a ["laptop task"](https://blogs.ubc.ca/etec523/2024/06/01/laptop-vs-mobile/) on a phone, you can now publish to your Hugo website on-the-go.