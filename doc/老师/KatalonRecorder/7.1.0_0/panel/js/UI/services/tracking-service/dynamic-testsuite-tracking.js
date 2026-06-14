import { trackingSegment } from "./segment-tracking-service.js";

const trackingAddTag = () => {
    return trackingSegment('kru_tc_add_tag');
}

const trackingRemoveTag = () => {
    return trackingSegment('kru_tc_remove_tag');
}

const trackingAddTagFromMangagement = () => {
    return trackingSegment('kru_tag_management_add_tag');
}

const trackingEditTagFromMangagement = () => {
    return trackingSegment('kru_tag_management_edit_tag');
}

const trackingRemoveTagFromMangagement = () => {
    return trackingSegment('kru_tag_management_remove_tag')
}

export {
    trackingAddTag,
    trackingRemoveTag,
    trackingAddTagFromMangagement,
    trackingEditTagFromMangagement,
    trackingRemoveTagFromMangagement
}