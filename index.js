const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const router = express.Router();
const cors = require('cors')
const ejs = require("ejs");
require('dotenv').config();

var market_indices = ['FTSE'];
var equities = [];
var market_indices_data = [];
var equities_data = [];
var rejectSearch = [];
var duplicated = [];
var marketdata = {};

const app = express();
app.use(express.static(__dirname + '/views'));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))
 
// parse application/json
app.use(bodyParser.json())
app.use(cors())


router.get("/", async (req, res) => {
    try {
        market_indices_data = await getStocks();
        equities_data = await getEquityStock();
    }catch(err){
        console.log("Error: at router('/')"+err)
    }finally {
        res.render('index', { data: market_indices_data, equities_data: equities_data,rejected: rejectSearch, duplicated: duplicated, indices: market_indices, marketdata: marketdata });

        rejectSearch.pop();
        duplicated.pop();
        marketdata = {};
    }
})

router.get("/search", async (req, res) => {
    let query_stock = req.query.name.toUpperCase();
    try {
        let checker = await checkStock(query_stock);
    switch(checker){
        case "Found":
            if(market_indices.includes(query_stock)){
                duplicated.push(query_stock);
            }else {
                market_indices.push(query_stock);
            }
            break;   
        case "MoreSearch": 
            marketdata = await lookupStock(query_stock);
            if(marketdata.headers.length == 0){
                rejectSearch.push(query_stock);
            }
            break; 
        case "NotFound": 
            rejectSearch.push(query_stock);
            break; 
        default: 
            rejectSearch.push(query_stock);
            break; 
    }
    }catch(err){
        console.log("Error: at router('/search')"+err)
    }finally{
        res.redirect("/");
    }
})

router.get("/item", (req, res) => {
    try {
        let item = req.query.name;
        if(item[0] == "^"){
            if(market_indices.includes(item.substring(1))){
                duplicated.push(item.substring(1))
            }else {
                market_indices.push(item.substring(1));
            }
        }else {
            if(equities.includes(item)){
                duplicated.push(item)
            }else {
                equities.push(item);
            } 
        }
    }catch(err){
        console.log("Error: at router('/item')"+err)
    }finally {
        res.redirect("/");
    }
})

app.use('/', router);
app.listen(process.env.PORT, () => {
    console.log(`Running on port: ${process.env.PORT}`);
})

async function getStocks(){
    let all = []
    let filters = [
        "No matching results for \'\'", 
        "Tip: Try a valid symbol or a specific company name for relevant results", 
        "Cancel",
        "Add to watchlist", 
        "Summary", 
        "Statistics", 
        "Historical data", 
        "Profile", 
        "Financials", 
        "Analysis", 
        "Options", 
        "Holders", 
        "Sustainability",
        "Components",
        "Add to watchlist"
    ];
    try {
        for(let i=0; i<market_indices.length; i++){
            let stockdetails = []
            const { data } = await axios.get(
                `https://sg.finance.yahoo.com/quote/%5E${market_indices[i]}?p=^${market_indices[i]}`);

            const $ = cheerio.load(data);
    
            $('div#quote-header-info').find('h1', 'data-reactid').each((_idx, el) => {
                stockdetails.push($(el).text());
            });

            let counter = 4;
            $('div#quote-header-info').find('span', 'data-reactid').each((_idx, el) => {
                if(filters.includes($(el).text())){
                }
                else {
                    if(counter > 0){
                        stockdetails.push($(el).text());
                    }
                    counter--;
                }
            });
            $('div#quote-summary').find('td', 'data-reactid').each((_idx, el) => {
                stockdetails.push($(el).text());
              }  
            );
            all.push(stockdetails);
        }
        return all;
    } catch (error) {
        throw error;
    }  
}

//To retrieve data for table lookup
async function lookupStock(stock){
    let contents = {
        headers: [],
        data: []
    }
    try {
            const { data } = await axios.get(
                `https://sg.finance.yahoo.com/lookup/all?s=${stock}`);

            const $ = cheerio.load(data);
    
            $('th').each((_idx, el) => {
                contents.headers.push($(el).text());
            });
            let all = [];
            let counter = 6;
            $('td').each((_idx, el) => {
                all.push($(el).text());
                counter--;
                if(counter==0){
                    contents.data.push(all);
                    counter = 6;
                    all = [];
                }
            });
        return contents;
    } catch (error) {
        throw error;
    }  
}

async function checkStock(stock){
    isNotFound = false;
    moreSearchRequired = false;
    try {
        const { data } = await axios.get(
            `https://sg.finance.yahoo.com/quote/%5E${stock}?p=^${stock}`
        );
        const $ = cheerio.load(data);

        let notFoundcondition1;
        let notFoundcondition2;
        $('span').each((_idx, el) => {
            
            notFoundcondition1 = $(el).text().search("N/A");
            notFoundcondition2 = $(el).text().search("Symbols similar to");
            if(notFoundcondition1 == 0){
                isNotFound = true;
            }
            if(notFoundcondition2 == 0){
                moreSearchRequired = true;
            }
        });
        if(isNotFound == true){
            return "NotFound";
        }else if(moreSearchRequired == true){
            return "MoreSearch";
        }else {
            return "Found";
        }
    } catch (error) {
        throw error;
    }
}

async function getEquityStock(){
    let all = [];

    //filters to ignore in web scraping
    let filters = [
        "No matching results for \'\'", 
        "Tip: Try a valid symbol or a specific company name for relevant results", 
        "Cancel", 
        "Summary", 
        "Statistics", 
        "Historical data", 
        "Profile", 
        "Financials", 
        "Analysis", 
        "Options", 
        "Holders", 
        "Sustainability",
        "Component",
        "Add to watchlist"
    ];
    try {
        for(let i=0; i<equities.length; i++){
            let stockdetails = []
            const { data } = await axios.get(
                `https://sg.finance.yahoo.com/quote/${equities[i]}?p=${equities[i]}`);

            const $ = cheerio.load(data);

            $('div#quote-header-info').find('h1', 'data-reactid').each((_idx, el) => {
                stockdetails.push($(el).text());
            });
            let counter =4;
            $('div#quote-header-info').find('span', 'data-reactid').each((_idx, el) => {
                if(filters.includes($(el).text())){
                    
                }
                else {
                    if(counter > 0){
                        stockdetails.push($(el).text());
                    }
                    counter--;
                }
              }  
            );
            $('div#quote-summary').find('td', 'data-reactid').each((_idx, el) => {
                stockdetails.push($(el).text());
              }  
            );
            all.push(stockdetails);
        }
        return all;
    } catch (error) {
        throw error;
    }  
}