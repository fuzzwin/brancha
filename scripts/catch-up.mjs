import {loadConfig} from './config.mjs';
import {ConversationMapper} from '../adapters/conversation-mapper.mjs';
import {MappingIntake} from '../adapters/mapping-intake.mjs';
import {ProjectReviewer} from '../adapters/project-reviewer.mjs';
const {config}=loadConfig(process.argv[2]);
if(!config.mapper?.enabled||!config.reviewer?.enabled){console.log(JSON.stringify({skipped:'automatic mapping or reviewer disabled'}));}
else{
 const intake=new MappingIntake(config,new ConversationMapper(config));
 // At most 8 batches of 100 stored receipt identities; no external transcript scan.
 let recovered=0,pending=false;
 for(let i=0;i<8;i++){const result=intake.tick();recovered+=result.queued||0;pending=!!result.remaining;if(!pending)break;}
 const reviewer=new ProjectReviewer(config),review=await reviewer.run();
 if(review.busy){reviewer.request();review.deferred=true;}
 console.log(JSON.stringify({recovered,intakeBacklog:pending,review}));
}
