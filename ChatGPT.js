const fetch = require('node-fetch')
class ChatGPT {
    static async tokenizerRecourceLoader(u1, u2) {
        let encoder = await (await fetch(u1)).json()
        let bpe_file = await (await fetch(u2)).text()
        return { encoder, bpe_file }
    }
    tokenizer(encoder = {}, bpe_file = '') {
        if (Object.keys(encoder).length === 0 || bpe_file === '') throw new Error('tokenizer: encoder, bpe_file 파라메터는 필수입니다');
        function encset(encoder, bpe_file) {
            const range = (x, y) => {
                const res = Array.from(Array(y).keys()).slice(x)
                return res
            }
            const ord = x => {
                return x.charCodeAt(0)
            }
            const chr = x => {
                return String.fromCharCode(x)
            }
            const textEncoder = new TextEncoder("utf-8")
            const encodeStr = str => {
                return Array.from(textEncoder.encode(str)).map(x => x.toString())
            }

            const textDecoder = new TextDecoder("utf-8")
            const decodeStr = arr => {
                return textDecoder.decode(new Uint8Array(arr));
            }

            const dictZip = (x, y) => {
                const result = {}
                x.map((_, i) => { result[x[i]] = y[i] })
                return result
            }

            function bytes_to_unicode() {
                const bs = range(ord('!'), ord('~') + 1).concat(range(ord('¡'), ord('¬') + 1), range(ord('®'), ord('ÿ') + 1))

                let cs = bs.slice()
                let n = 0
                for (let b = 0; b < 2 ** 8; b++) {
                    if (!bs.includes(b)) {
                        bs.push(b)
                        cs.push(2 ** 8 + n)
                        n = n + 1
                    }
                }

                cs = cs.map(x => chr(x))

                const result = {}
                bs.map((_, i) => { result[bs[i]] = cs[i] })
                return result
            }

            function get_pairs(word) {
                const pairs = new Set()
                let prev_char = word[0]
                for (let i = 1; i < word.length; i++) {
                    const char = word[i]
                    pairs.add([prev_char, char])
                    prev_char = char
                }
                return pairs
            }

            const pat = /'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu

            const decoder = {}
            Object.keys(encoder).map(x => { decoder[encoder[x]] = x })

            const lines = bpe_file.split('\n')

            // bpe_merges = [tuple(merge_str.split()) for merge_str in bpe_data.split("\n")[1:-1]]
            const bpe_merges = lines.slice(1, lines.length - 1).map(x => {
                return x.split(/(\s+)/).filter(function (e) { return e.trim().length > 0 })
            })

            const byte_encoder = bytes_to_unicode()
            const byte_decoder = {}
            Object.keys(byte_encoder).map(x => { byte_decoder[byte_encoder[x]] = x })

            const bpe_ranks = dictZip(bpe_merges, range(0, bpe_merges.length))
            const cache = new Map;

            function bpe(token) {
                if (cache.has(token)) {
                    return cache.get(token)
                } ``

                let word = token.split('')

                let pairs = get_pairs(word)

                if (!pairs) {
                    return token
                }

                while (true) {
                    const minPairs = {}
                    Array.from(pairs).map(pair => {
                        const rank = bpe_ranks[pair]
                        minPairs[(isNaN(rank) ? 10e10 : rank)] = pair
                    })



                    const bigram = minPairs[Math.min(...Object.keys(minPairs).map(x => {
                        return parseInt(x)
                    }
                    ))]

                    if (!(bigram in bpe_ranks)) {
                        break
                    }

                    const first = bigram[0]
                    const second = bigram[1]
                    let new_word = []
                    let i = 0

                    while (i < word.length) {
                        const j = word.indexOf(first, i)
                        if (j === -1) {
                            new_word = new_word.concat(word.slice(i))
                            break
                        }
                        new_word = new_word.concat(word.slice(i, j))
                        i = j

                        if (word[i] === first && i < word.length - 1 && word[i + 1] === second) {
                            new_word.push(first + second)
                            i = i + 2
                        } else {
                            new_word.push(word[i])
                            i = i + 1
                        }
                    }

                    word = new_word
                    if (word.length === 1) {
                        break
                    } else {
                        pairs = get_pairs(word)
                    }
                }

                word = word.join(' ')
                cache.set(token, word)

                return word
            }

            function encode(text) {
                let bpe_tokens = []
                const matches = Array.from(text.matchAll(pat)).map(x => x[0])
                for (let token of matches) {
                    token = encodeStr(token).map(x => {
                        return byte_encoder[x]
                    }).join('')

                    const new_tokens = bpe(token).split(' ').map(x => encoder[x])
                    bpe_tokens = bpe_tokens.concat(new_tokens)
                }
                return bpe_tokens
            }

            function decode(tokens) {
                let text = tokens.map(x => decoder[x]).join('')
                text = decodeStr(text.split('').map(x => byte_decoder[x]))
                return text
            }
            return {
                encode,
                decode
            }
        }
        return encset(encoder, bpe_file);
    }
    apiKey = null;
    static USDPERTOKEN = 0.000002
    static KRWUSD = 1304.50
    constructor({ apiKey, encoder, bpe_file, promptTokenLimit }) {
        this.apiKey = apiKey;
        this.Encoder = this.tokenizer(encoder, bpe_file);
        this.promptTokenLimit = promptTokenLimit;
    }
    header() {
        return this.apiKey ? {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
        } : {};
    }
    static getBinaryBytes(string) {
        const encoder = new TextEncoder();
        const byteString = encoder.encode(string);
        let binaryBytes = "";
        for (let byte of byteString) {
            binaryBytes += byte.toString(2).padStart(8, '0');
        }
        const byteChunks = binaryBytes.match(/.{1,8}/g);
        const byteList = byteChunks.map(chunk => parseInt(chunk, 2));
        const binaryBytesResult = new Uint8Array(byteList);
        return binaryBytesResult.length;
    }
    getSysLine(prompt) { return prompt.filter(line => line.role === 'system')[0] }
    cutFrontPrompt(prompt) {
        let newPrompt = [];
        let tokenSum = 0;
        let systems = this.getSysLine(prompt)
        if (systems) tokenSum += systems.token
        for (let i = prompt.length - 1; i >= 0; i--) {
            let item = prompt[i];
            if (item.role === 'system') continue;
            if (item.token) tokenSum += item.token;
            if (tokenSum <= this.promptTokenLimit) newPrompt.push(item)
            else break;
        }
        if (systems) newPrompt.push(systems)
        return newPrompt.reverse();
    }
    measureImprove(data) {
        let src = Object.keys(data).map(key => `${key}:'${data[key]}'`).join(',')
        return this.Encoder.encode(src).length
    }
    measureAndSetPrompt(prompt) {
        for (let line of prompt) if (!line.hasOwnProperty('token')) line.token = this.measureImprove(line);
        return prompt
    }
    measureToken(prompt) { return prompt.reduce((sum, line) => sum + this.measureImprove(line), 0); }
    async checkInappropriate(message) {
        const result = await this.moderation(message)
        const { categories } = result.results[0];
        const inappropriate = Object.keys(categories).filter(category => categories[category]);
        if (inappropriate.length) return {
            message: 'Your input is inappropriate',
            categories: inappropriate,
            code: 'inappropriate_input'
        };
    }
    sumTokenSize(obj) { return obj.reduce((sum, { token }) => sum + (token || 0), 0); }
    async completion(prompt, payload = {}, signal) {
        let worktime = new Date();
        prompt = this.measureAndSetPrompt(prompt);
        prompt = this.cutFrontPrompt(prompt);
        const inner = async (prompt, payload = {}) => {
            let resolver, rejecter, errorData;
            let actualUsage;
            const promise = new Promise((resolve, reject) => {
                resolver = resolve
                rejecter = reject
            });
            payload = { ...payload };
            prompt = [...prompt];
            const { moderation, stream } = payload;
            delete payload.moderation;
            delete payload.stream;
            const marginLimit = Math.round(4096 * 0.3) * 0;
            const tokenLimit = 4096 - marginLimit;
            const ENDPOINT = 'https://api.openai.com/v1/chat/completions';
            const sumsize = this.sumTokenSize(prompt);
            let messages = prompt.map(log => ({ role: log.role, content: log.content }));
            const data = {
                model: "gpt-3.5-turbo",
                messages,
                temperature: 0.7,
                stream: !!stream,
                // max_tokens: tokenLimit - sumsize,
                n: 1,
                ...payload
            };
            let role = '';
            let content = [];
            let finish_reason = null;
            let token;
            let error = null;
            let message = null;
            let contentData;
            function event(data) {
                if (data && data.tokens) token = data.tokens
                if (data) {
                    if (data.finish_reason) finish_reason = data.finish_reason
                    if (data.role) role += data.role;
                    if (data.content) {
                        stream({ role, content: data.content });
                        content.push(data.content);
                    }
                } else {
                    const rt = { role, content: content.join(''), finish_reason, token };
                    !finish_reason && stream(rt)
                    resolver(rt);
                }
            }
            function errorJSON(data) {
                try {
                    let datas = JSON.parse(data)
                    if (datas.error) return datas.error;
                } catch { }
                return null;
            }
            if (moderation) {
                let bad = await this.checkInappropriate(moderation)
                if (bad) errorData = bad
            }
            if (errorData) {
                error = errorData
            }
            else {
                if (!data.stream) {
                    const fetchoption = { method: 'POST', body: JSON.stringify(data), headers: this.header(), signal };
                    let ress = await fetch(ENDPOINT, fetchoption);
                    ress = await ress.json()
                    if (ress.error) {
                    } else {
                        actualUsage = ress.usage;
                        const message = ress.choices[0].message
                        message.finish_reason = ress.choices[0].finish_reason
                        let tokenSize = this.measureImprove({ role: message.role, content: message.content });
                        message.token = tokenSize;
                    }
                    if (ress.error) {
                        rejecter(ress.error)
                    } else {
                        const message = ress.choices[0].message
                        resolver(message)
                    }
                } else {
                    const fetchoption = { method: 'POST', body: JSON.stringify(data), headers: this.header(), signal };
                    await fetch(ENDPOINT, fetchoption).then(response => {
                        let tokens = 0;
                        const reader = response.body.getReader();
                        const decoder = new TextDecoder();
                        reader.read().then(function processResult(result) {
                            let data = decoder.decode(result.value, { stream: true });
                            let error = errorJSON(data)
                            if (error) {
                                rejecter(error);
                                return;
                            }
                            let dataList = data.trim().split('\n');
                            for (let line of dataList) {
                                line = line.trim()
                                if (!line) continue;
                                if (line.startsWith("data: ")) line = line.slice(6);
                                if ('[DONE]' === line) continue;
                                tokens++;
                                const { delta, finish_reason } = JSON.parse(line).choices[0];
                                delta.finish_reason = finish_reason
                                delta.tokens = tokens
                                event(delta)
                            }
                            if (result.done) event(null);
                            else reader.read().then(processResult);
                        });
                    });
                }

                try {
                    message = await promise;
                    let tokenSize = this.measureImprove({ role: message.role, content: message.content });
                    message.token = tokenSize;
                    prompt.push(message);
                    if (message) {
                        contentData = message.content
                    } else {
                        contentData = undefined
                    }
                } catch (e) {
                    error = e;
                }
            }
            return { actualUsage, error, finish_reason, message, prompt, content: contentData };
        }
        let result = {};
        while (true) {
            if (!prompt.length) {
                result.error = { message: '' }
                break;
            }
            result = await inner(prompt, payload)
            let error = undefined;
            if (result && result.error) {
                error = result.error
            }
            if (!error) break;
            let mode = 0;
            let message = error.message;
            if (!message) break;
            if (message.indexOf('Rate limit reached for') > -1) mode = 0;
            if (error.code === 'context_length_exceeded' && error.type === 'invalid_request_error' && message.startsWith(`This model's maximum context length is `)) {
                this.emphasis(prompt);
                mode = 2;
            }
            if (!mode) {
                this.removeLastOfPrompt(prompt)
                break;
            }
            if (mode === 2) await new Promise((resolve) => setTimeout(resolve, 0));
        }
        return result;
    }
    removeLastOfPrompt(prompt) { prompt.splice(prompt.length - 1, 1); }
    emphasis(prompt) {
        prompt = this.measureAndSetPrompt(prompt);
        const sumsizeb4 = this.sumTokenSize(prompt);
        while (prompt.length) {
            if (!(this.sumTokenSize(prompt) <= sumsizeb4)) break;
            for (let i = 0; i < prompt.length; i++) prompt[i].token = Math.ceil(prompt[i].token * 1.1);
        }
    }
    async moderation(prompt) {
        const data = {
            input: prompt,
        };
        const response = await fetch('https://api.openai.com/v1/moderations', {
            method: 'POST',
            body: JSON.stringify(data),
            headers: this.header(),
        });
        return await response.json()
    }
}
module.exports = ChatGPT;
