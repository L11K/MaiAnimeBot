require('dotenv').config()

// Req MAL api
const malScraper = require('mal-scraper')

// Other MAL api for scraping Seiyuus
const Mal = require("node-myanimelist")

// Req Discord api
const Discord = require('discord.js')
const client = new Discord.Client()

// Discord stuffs
const TOKEN = process.env.TOKEN
const ADMINID = process.env.ADMINID
const PREFIX = '!'

const showRegex = /\<(.+?)\>/
const seiyuuRegex = /\[(.+?)\]/
const mangaRegex = /\{(.+?)\}/
const channelRegex = /\<\#(.+?)\>/

var verboseReverb = false;

client.on('ready', () => console.log('Mai is ready! <3'))

client.on('error', console.error)

client.on('message', async message => {
    if (message.author.bot) { return }
    const command = message.content.toLowerCase().split(' ')[0]
    const arguments = message.content.split(' ')
    const guildowner = message.channel.guild.ownerID
    const messageauthor = message.author.id
    arguments.shift()
    if (verboseReverb) {
        console.log("VERBOSE: " + message.content)
        message.channel.send("VERBOSE: " + "```\n" + escapeMarkdown(message.content) + "\n```")
    }
    if (command == `${PREFIX}ping`) {
        message.reply('I\'m here!')
        return
    }
    if (command == `${PREFIX}whatsmyid`) {
        message.reply('Your discord author id is ' + messageauthor)
        return
    }
    if (command == `${PREFIX}debug`) {
        if(ADMINID != undefined) {
            if(messageauthor == ADMINID){
                handleDebug(arguments, message)
            }
        }
    }
    if (command == `${PREFIX}mal`) { handleMalQuery(arguments.join(" "), message, true, false) }
    if (command == `${PREFIX}7up`) { handleMalQuery(arguments.join(" "), message, true, true) }
    if (command == `${PREFIX}seiyuu`) { handleSeiyuuQuery(arguments.join(" "), message, true) }
    if (command == `${PREFIX}manga`) { handleMangaQuery(arguments.join(" "), message, true) }
    if (command == `${PREFIX}purge`) { handlePurge(arguments, message, guildowner, messageauthor) }
    if (command == `${PREFIX}movechat`) { handleMoveChat(arguments, message, guildowner, messageauthor) }

    var matches = message.content.match(showRegex)
    if (matches) {
        var query = matches[1]
        var deletemessage = matches[0] == message.content
        if (query.startsWith("@") || query.startsWith(":") || query.startsWith("#") || query.startsWith("a:")) { return }
        handleMalQuery(query, message, deletemessage, false)
    }

    var seiyuumatches = message.content.match(seiyuuRegex)
    if (seiyuumatches) {
        var query = seiyuumatches[1]
        var deletemessage = seiyuumatches[0] == message.content
        handleSeiyuuQuery(query, message, deletemessage)
    }

    var mangamatches = message.content.match(mangaRegex)
    if (mangamatches) {
        var query = mangamatches[1]
        var deletemessage = mangamatches[0] == message.content
        handleMangaQuery(query, message, deletemessage)
    }
})

client.login(TOKEN)

function handleMalQuery(query, message, deletemessage, is7up) {
    malScraper.getResultsFromSearch(query)
        .then(data => {
            if (is7up) {
                var above7 = data.filter(show => show.payload.score >= 7)
                if (is7up && above7.length === 0) {
                    message.channel.send("Mai couldn't find a result that has a score above 7!")
                    return
                }
            }
            var candidateShow = above7 ? above7[0] : data[0]
            var { name, url } = candidateShow
            var { start_year: year, score, status } = candidateShow.payload
            malScraper.getInfoFromURL(url)
                .then(data => {
                    var image = data.picture
                    var genres = "`" + data.genres.join("` `") + "`"
                    var studios = data.studios.join(", ")
                    var { rating, ranked, popularity, synopsis } = data
                    synopsis = toTweetLength(synopsis)
                    message.channel.send({
                        content: url, embed: {
                            title: name,
                            url: url,
                            color: 65508,
                            footer: {
                                icon_url: message.author.avatarURL,
                                text: message.author.username + "#" + message.author.discriminator
                            },
                            image: {
                                url: image
                            },
                            timestamp: new Date(),
                            fields: [
                                {
                                    name: "Synopsis",
                                    value: synopsis,
                                },
                                {
                                    name: "Genres",
                                    value: genres,
                                },
                                {
                                    name: "Studios",
                                    value: studios,
                                },
                                {
                                    name: "Score",
                                    value: score,
                                    inline: true
                                },
                                {
                                    name: "Ranked",
                                    value: ranked,
                                    inline: true
                                },
                                {
                                    name: "Popularity",
                                    value: popularity,
                                    inline: true
                                },
                                {
                                    name: "Rating",
                                    value: rating,
                                },
                                {
                                    name: "Year",
                                    value: year,
                                    inline: true
                                },
                                {
                                    name: "Status",
                                    value: status,
                                    inline: true
                                }
                            ]
                        }
                    })
                    if (deletemessage) message.delete().catch((err) => { })
                })
                .catch((err) => console.error(err))
        })
        .catch((err) => console.error(err))
}

function handleSeiyuuQuery(query, message, deletemessage) {
    Mal.search("person", query, { limit: 1, Page: 1 }).then(j => {
        var seiyuuarray = []
        var seiyuuarraylength = j.results.length
        j.results.forEach(person => {
            Mal.person(person.mal_id).then(function (j) {
                person.popularity = j.member_favorites
                seiyuuarray.push(person)
                handlejump()
            })
        })
        function handlejump() {
            if (seiyuuarraylength == seiyuuarray.length) {
                seiyuuarray.sort(function (a, b) { return b.popularity - a.popularity })
                var result = seiyuuarray[0]
                var { name, url, image_url: image } = result
                var embedobj = {
                    title: name,
                    url: url,
                    color: 16728193,
                    footer: {
                        icon_url: message.author.avatarURL,
                        text: message.author.username + "#" + message.author.discriminator
                    },
                    image: {
                        url: image
                    },
                    timestamp: new Date(),
                    fields: []
                }

                Mal.person(result.mal_id).then(j => {
                    var birthday = new Date(Date.parse(j.birthday))
                    var formattedbirthday
                    var birthdayexists = false
                    var bdaymonth = birthday.getMonth() + 1

                    if (birthday.getFullYear()) {

                        formattedbirthday = birthday.getDate() + "/" + bdaymonth + "/" + birthday.getFullYear()
                        birthdayexists = true

                    } else if (birthday.getMonth()) {

                        formattedbirthday = birthday.getDate() + "/" + bdaymonth
                        birthdayexists = true

                    }

                    if (birthdayexists) {
                        embedobj.fields.unshift({
                            name: "Birthday",
                            value: formattedbirthday,
                        })
                    }

                    var about = j.about
                    if (typeof (about) == "string") {
                        about = about.split("\n")
                        for (var element of about) {
                            var clean = element.replace(/(\r\n|\n|\r|\\n)/gm, "").split(/:(.+)/)
                            if (clean.length >= 2) {
                                embedobj.fields.unshift({
                                    name: clean[0],
                                    value: clean[1]
                                })
                            }
                        }
                    }
                    message.channel.send({ content: url, embed: embedobj })
                    if (deletemessage) message.delete().catch((err) => { })
                })
            }
        }
    })
}


function handleMangaQuery(query, message, deletemessage) {
    Mal.search("manga", query, { limit: 1, Page: 1 }).then(j => {
        var { title, url, image_url: image } = j.results[0]
        Mal.manga(j.results[0].mal_id).then(data => {
            image = data.image_url
            var genres = processMangaGenres(data.genres)
            var { rank: ranked, popularity, status } = data
            if (ranked == null) {
                ranked = "N/A"
            }
            var score = data.score.toString()
            var synopsis = toTweetLength(data.synopsis)
            message.channel.send({
                content: url, embed: {
                    title: title,
                    url: url,
                    color: 2817854,
                    footer: {
                        icon_url: message.author.avatarURL,
                        text: message.author.username + "#" + message.author.discriminator
                    },
                    image: {
                        url: image
                    },
                    timestamp: new Date(),
                    fields: [
                        {
                            name: "Synopsis",
                            value: synopsis,
                        },
                        {
                            name: "Genres",
                            value: genres,
                        },
                        {
                            name: "Score",
                            value: score,
                            inline: true
                        },
                        {
                            name: "Ranked",
                            value: ranked,
                            inline: true
                        },
                        {
                            name: "Popularity",
                            value: popularity,
                            inline: true
                        },
                        {
                            name: "Status",
                            value: status,
                            inline: true
                        }
                    ]
                }
            })
            if (deletemessage) message.delete().catch((err) => { })
        })
    })
}

async function handlePurge(arguments, message, guildowner, messageauthor){
    if (guildowner == messageauthor || ADMINID == messageauthor) {
        if (arguments.length < 1) {
            message.channel.send('Please tell Mai-Chan how many messages you want to delete! >a<')
                .then(msg => {
                    msg.delete(3000)
                })
            return
        }
        if (!arguments[0]) {
            message.channel.send('I need numbers!!!')
                .then(msg => {
                    msg.delete(3000)
                })
            return
        }
        if (arguments[0] > 10) {
            message.channel.send('Mai-Chan can only delete up to 10 messages at a time you know!')
                .then(msg => {
                    msg.delete(3000)
                })
            return
        }
        if (arguments[0] < 1) {
            message.channel.send('Mai-Chan deleted 0 messages! None! (maybe have an integer greater than 0 next time?)')
                .then(msg => {
                    msg.delete(3000)
                })
            return
        } else {
            let deletedMessages = await message.channel.bulkDelete(parseInt(arguments[0]) + 1, true)
            message.channel.send(`Mai-Chan deleted ${deletedMessages.size - 1} messages!`)
                .then(msg => {
                    msg.delete(3000)
                })
            return
        }
    } else {
        message.channel.send("Only the Owner of this Guild/Server can use this command")
            .then(msg => {
                msg.delete(3000)
            })
            message.delete().catch((err) => { })
        return
    }
}

async function handleMoveChat(arguments, message, guildowner, messageauthor){
    if (guildowner == messageauthor || ADMINID == messageauthor) {
        if (arguments.length < 1) {
            message.channel.send('Please tell Mai-Chan how many messages you want to move! >a<')
                .then(msg => {
                    msg.delete(3000)
                })
            return
        }
        if (!arguments[0]) {
            message.channel.send('I need numbers!!!')
                .then(msg => {
                    msg.delete(3000)
                })
            return
        }
        if (arguments[0] > 50) {
            message.channel.send('Mai-Chan can only move up to 50 messages at a time you know!')
                .then(msg => {
                    msg.delete(3000)
                })
            return
        }
        if (arguments[0] < 1) {
            message.channel.send('Mai-Chan moved 0 messages! None! (maybe have an integer greater than 0 next time?)')
                .then(msg => {
                    msg.delete(3000)
                })
            return
        }
        if (arguments[1] == undefined) {
            message.channel.send('I need to know what channel you want me to move the chat to!')
                .then(msg => {
                    msg.delete(3000)
                })
            return
        } else {
            var matches = arguments[1].match(channelRegex)
            if (matches) {
                var specifiedchannel = matches[1]
                if (message.guild.channels.has(specifiedchannel)){
                    if (message.channel.id == specifiedchannel){
                        message.channel.send('The channel you specified is this channel. Please specify a different channel.')
                            .then(msg => {
                                msg.delete(3000)
                            })
                        return
                    }
                    var targetchannel = message.guild.channels.get(specifiedchannel)
                    message.delete()
                        .then(()=>{
                            message.channel.fetchMessages({ limit: arguments[0] })
                                .then(async messages => {
                                    var messagearr = [];
                                    for (var item of messages){
                                        if(item[1].embeds.length == 0){
                                            var itemobj = {
                                                embed: false,
                                                username: item[1].author.username + "#" + item[1].author.discriminator,
                                                avatarURL: item[1].author.avatarURL,
                                                content: item[1].content,
                                                timestamp: item[1].createdTimestamp
                                            }
                                            messagearr.push(itemobj);
                                        }else{
                                            var itemobj = {
                                                embed: true,
                                                embedcontent: item[1].embeds[0]
                                            }
                                            messagearr.push(itemobj);
                                        }
                                    }
                                    for (var itemobj of messagearr.reverse()){
                                        if(!itemobj.embed){
                                            var embedobj = {
                                                author: {
                                                    name: itemobj.username,
                                                    icon_url: itemobj.avatarURL
                                                },
                                                description: itemobj.content + "\n",
                                                color: 14935344,
                                                timestamp: new Date(itemobj.timestamp),
                                            }
                                        }else{
                                            embedobj = itemobj.embedcontent
                                        }
                                        targetchannel.send({
                                            content: "", embed: embedobj
                                        })
                                    }
                                    let deletedMessages = await message.channel.bulkDelete(parseInt(arguments[0]), true)
                                    message.channel.send(`Mai-Chan moved ${deletedMessages.size} messages!`)
                                        .then(msg => {
                                            msg.delete(3000)
                                        })
                                })
                                .catch(console.error);
                            }
                        )
                        .catch((err) => { })
                    return
                }else{
                    message.channel.send('The channel that you sent does not exist on this server.')
                        .then(msg => {
                            msg.delete(3000)
                        })
                    return
                }
            }else{
                message.channel.send('The channel that you sent seems to be malformed. Please replace the second argument of the command with #`channel`')
                    .then(msg => {
                        msg.delete(3000)
                    })
                return
            }   
        }
    } else {
        message.channel.send("Only the Owner of this Guild/Server can use this command")
            .then(msg => {
                msg.delete(3000)
            })
            message.delete().catch((err) => { })
        return
    }
}

function handleDebug(arguments, message){
    if (arguments[0].toLowerCase() == "verbose"){
        verboseReverb = !verboseReverb
        if(verboseReverb){
            message.channel.send("Verbose has been turned on")
        } else {
            message.channel.send("Verbose has been turned off")
        }
    }
}

function toTweetLength(input) {
    if (input.length <= 140) {
        return input
    }
    return input.slice(0, 140) + "..."
}

function processMangaGenres(input) {
    var genrearr = input.map(m => m.name)
    return "`" + genrearr.join("` `") + "`"
}

function escapeMarkdown(string){
    var replacements = [
        [ /\`\`\`/g, '`​`​`​' ]
    ]
    return replacements.reduce(
        function(string, replacement) {
          return string.replace(replacement[0], replacement[1])
        }, string)
}