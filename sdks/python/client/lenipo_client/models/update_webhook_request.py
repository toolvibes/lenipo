from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.update_webhook_request_locale import UpdateWebhookRequestLocale
from ..models.webhook_event_type import WebhookEventType
from ..models.webhook_format import WebhookFormat
from ..types import UNSET, Unset
from typing import cast
from uuid import UUID






T = TypeVar("T", bound="UpdateWebhookRequest")



@_attrs_define
class UpdateWebhookRequest:
    """ 
        Attributes:
            name (str | Unset):
            url (str | Unset):
            events (list[WebhookEventType] | Unset):
            project_keys (list[str] | Unset):
            status_ids (list[UUID] | Unset):
            tql (None | str | Unset):
            space_keys (list[str] | Unset):
            format_ (WebhookFormat | Unset):
            locale (UpdateWebhookRequestLocale | Unset):
            enabled (bool | Unset):
     """

    name: str | Unset = UNSET
    url: str | Unset = UNSET
    events: list[WebhookEventType] | Unset = UNSET
    project_keys: list[str] | Unset = UNSET
    status_ids: list[UUID] | Unset = UNSET
    tql: None | str | Unset = UNSET
    space_keys: list[str] | Unset = UNSET
    format_: WebhookFormat | Unset = UNSET
    locale: UpdateWebhookRequestLocale | Unset = UNSET
    enabled: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        name = self.name

        url = self.url

        events: list[str] | Unset = UNSET
        if not isinstance(self.events, Unset):
            events = []
            for events_item_data in self.events:
                events_item = events_item_data.value
                events.append(events_item)



        project_keys: list[str] | Unset = UNSET
        if not isinstance(self.project_keys, Unset):
            project_keys = self.project_keys



        status_ids: list[str] | Unset = UNSET
        if not isinstance(self.status_ids, Unset):
            status_ids = []
            for status_ids_item_data in self.status_ids:
                status_ids_item = str(status_ids_item_data)
                status_ids.append(status_ids_item)



        tql: None | str | Unset
        if isinstance(self.tql, Unset):
            tql = UNSET
        else:
            tql = self.tql

        space_keys: list[str] | Unset = UNSET
        if not isinstance(self.space_keys, Unset):
            space_keys = self.space_keys



        format_: str | Unset = UNSET
        if not isinstance(self.format_, Unset):
            format_ = self.format_.value


        locale: str | Unset = UNSET
        if not isinstance(self.locale, Unset):
            locale = self.locale.value


        enabled = self.enabled


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if name is not UNSET:
            field_dict["name"] = name
        if url is not UNSET:
            field_dict["url"] = url
        if events is not UNSET:
            field_dict["events"] = events
        if project_keys is not UNSET:
            field_dict["projectKeys"] = project_keys
        if status_ids is not UNSET:
            field_dict["statusIds"] = status_ids
        if tql is not UNSET:
            field_dict["tql"] = tql
        if space_keys is not UNSET:
            field_dict["spaceKeys"] = space_keys
        if format_ is not UNSET:
            field_dict["format"] = format_
        if locale is not UNSET:
            field_dict["locale"] = locale
        if enabled is not UNSET:
            field_dict["enabled"] = enabled

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name", UNSET)

        url = d.pop("url", UNSET)

        _events = d.pop("events", UNSET)
        events: list[WebhookEventType] | Unset = UNSET
        if _events is not UNSET:
            events = []
            for events_item_data in _events:
                events_item = WebhookEventType(events_item_data)



                events.append(events_item)


        project_keys = cast(list[str], d.pop("projectKeys", UNSET))


        _status_ids = d.pop("statusIds", UNSET)
        status_ids: list[UUID] | Unset = UNSET
        if _status_ids is not UNSET:
            status_ids = []
            for status_ids_item_data in _status_ids:
                status_ids_item = UUID(status_ids_item_data)



                status_ids.append(status_ids_item)


        def _parse_tql(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        tql = _parse_tql(d.pop("tql", UNSET))


        space_keys = cast(list[str], d.pop("spaceKeys", UNSET))


        _format_ = d.pop("format", UNSET)
        format_: WebhookFormat | Unset
        if isinstance(_format_,  Unset):
            format_ = UNSET
        else:
            format_ = WebhookFormat(_format_)




        _locale = d.pop("locale", UNSET)
        locale: UpdateWebhookRequestLocale | Unset
        if isinstance(_locale,  Unset):
            locale = UNSET
        else:
            locale = UpdateWebhookRequestLocale(_locale)




        enabled = d.pop("enabled", UNSET)

        update_webhook_request = cls(
            name=name,
            url=url,
            events=events,
            project_keys=project_keys,
            status_ids=status_ids,
            tql=tql,
            space_keys=space_keys,
            format_=format_,
            locale=locale,
            enabled=enabled,
        )


        update_webhook_request.additional_properties = d
        return update_webhook_request

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
