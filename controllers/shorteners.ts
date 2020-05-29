import { RouterContext } from "https://deno.land/x/oak/mod.ts";
import { ShortenedLink } from "../types.ts";
import db from "../mongodb.ts";

const shortCollection = db.collection("shorts");

// @desc            Get all shortened links
// @routes          GET /api/shorts
const getShorts = async (ctx : RouterContext) => {
    const shorts = await shortCollection.find();
    ctx.response.body = {
        success: true,
        data: shorts,
    }
}


// @desc            Get one shortened links
// @routes          GET /api/:name
const getShort = async (ctx : RouterContext) => {
    const name = ctx.params.name;
    const short = await shortCollection.findOne({name: name});

    if(!short){
        ctx.response.status = 404;
        ctx.response.body = {
            success: false,
            msg: `No link with the name ${ctx.params.name} found`,
        }
        return;
    }

    ctx.response.status = 200;
    ctx.response.body = {
        success: true,
        data: short
    }
}


// @desc            Add a shortened link
// @routes          POST /api/shorts
const addShort = async (ctx : RouterContext) => {

    if (!ctx.request.hasBody) {
        ctx.response.status = 400;
        ctx.response.body = {
            success: false,
            msg: 'No data'
        }
        return;
    }

    const body = await ctx.request.body();
    const {name, link}:ShortenedLink = body.value;
    const short : ShortenedLink = {
        name,
        link
    };

    const exist = await shortCollection.findOne({name: name}) ? true : false;

    if(exist){
        ctx.response.status = 405;
        ctx.response.body = {
            success: false,
            msg: `Link with the name ${name} already exist`,
        }
        return;
    }


    await shortCollection.insertOne(short);

    ctx.response.status = 201;
    ctx.response.body = {
        success: true,
        data: short,
    };
}


// @desc            Get all shortened links
// @routes          PUT /api/shorts/:name
const updateShort = async (ctx : RouterContext) => {
    const name = ctx.params.name;

    if (!ctx.request.hasBody) {
        ctx.response.status = 400;
        ctx.response.body = {
            success: false,
            msg: 'No data'
        }
        return;
    }

    const exist = await shortCollection.findOne({name: name}) ? true : false;

    if(!exist){
        ctx.response.status = 404;
        ctx.response.body = {
            success: false,
            msg: `No link with the name ${ctx.params.name} found`,
        }
        return;
    }

    const body = await ctx.request.body();
    const {link} = body.value;
    
    await shortCollection.updateOne({name: name}, {
        $set: {
            link
        }
    });

    ctx.response.status = 200;
    ctx.response.body = {
        success: true,
        data: {
            name,
            link,
        }
    }
}


// @desc            Get all shortened links
// @routes          DELETE /api/shorts/:name
const deleteShort = async (ctx : RouterContext) => {
    const name = ctx.params.name;
    const exist = await shortCollection.findOne({name: name}) ? true : false;

    if(!exist){
        ctx.response.status = 404;
        ctx.response.body = {
            success: false,
            msg: `No link with the name ${ctx.params.name} found`,
        }
        return;
    }

    await shortCollection.deleteOne({name: name});

    ctx.response.body = {
        success: true,
        msg: `Link with name ${name} Removed`,
    }
}

export { getShorts, getShort, addShort, updateShort, deleteShort };