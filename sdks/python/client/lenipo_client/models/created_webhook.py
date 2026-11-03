from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.created_webhook_locale import CreatedWebhookLocale
from ..models.webhook_event_type import WebhookEventType
from ..models.webhook_format import WebhookFormat
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.created_webhook_last_delivery_type_0 import CreatedWebhookLastDeliveryType0





T = TypeVar("T", bound="CreatedWebhook")



@_attrs_define
class CreatedWebhook:
    """ 
        Attributes:
            id (UUID):
            name (str):
            url (str):
            events (list[WebhookEventType]):
            project_keys (list[str]):
            status_ids (list[UUID]):
            tql (None | str):
            space_keys (list[str]):
            format_ (WebhookFormat):
            locale (CreatedWebhookLocale):
            enabled (bool):
            disabled_reason (None | str):
            failing_since (datetime.datetime | None):
            last_delivery (CreatedWebhookLastDeliveryType0 | None):
            created_at (datetime.datetime):
            secret (str):
     """

    id: UUID
    name: str
    url: str
    events: list[WebhookEventType]
    project_keys: list[str]
    status_ids: list[UUID]
    tql: None | str
    space_keys: list[str]
    format_: WebhookFormat
    locale: CreatedWebhookLocale
    enabled: bool
    disabled_reason: None | str
    failing_since: datetime.datetime | None
    last_delivery: CreatedWebhookLastDeliveryType0 | None
    created_at: datetime.datetime
    secret: str





    def to_dict(self) -> dict[str, Any]:
        from ..models.created_webhook_last_delivery_type_0 import CreatedWebhookLastDeliveryType0 # noqa: PLC0415
        id = str(self.id)

        name = self.name

        url = self.url

        events = []
        for events_item_data in self.events:
            events_item = events_item_data.value
            events.append(events_item)



        project_keys = self.project_keys



        status_ids = []
        for status_ids_item_data in self.status_ids:
            status_ids_item = str(status_ids_item_data)
            status_ids.append(status_ids_item)



        tql: None | str
        tql = self.tql

        space_keys = self.space_keys



        format_ = self.format_.value

        locale = self.locale.value

        enabled = self.enabled

        disabled_reason: None | str
        disabled_reason = self.disabled_reason

        failing_since: None | str
        if isinstance(self.failing_since, datetime.datetime):
            failing_since = self.failing_since.isoformat()
        else:
            failing_since = self.failing_since

        last_delivery: dict[str, Any] | None
        if isinstance(self.last_delivery, CreatedWebhookLastDeliveryType0):
            last_delivery = self.last_delivery.to_dict()
        else:
            last_delivery = self.last_delivery

        created_at = self.created_at.isoformat()

        secret = self.secret


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "name": name,
            "url": url,
            "events": events,
            "projectKeys": project_keys,
            "statusIds": status_ids,
            "tql": tql,
            "spaceKeys": space_keys,
            "format": format_,
            "locale": locale,
            "enabled": enabled,
            "disabledReason": disabled_reason,
            "failingSince": failing_since,
            "lastDelivery": last_delivery,
            "createdAt": created_at,
            "secret": secret,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.created_webhook_last_delivery_type_0 import CreatedWebhookLastDeliveryType0 # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        url = d.pop("url")

        events = []
        _events = d.pop("events")
        for events_item_data in (_events):
            events_item = WebhookEventType(events_item_data)



            events.append(events_item)


        project_keys = cast(list[str], d.pop("projectKeys"))


        status_ids = []
        _status_ids = d.pop("statusIds")
        for status_ids_item_data in (_status_ids):
            status_ids_item = UUID(status_ids_item_data)



            status_ids.append(status_ids_item)


        def _parse_tql(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        tql = _parse_tql(d.pop("tql"))


        space_keys = cast(list[str], d.pop("spaceKeys"))


        format_ = WebhookFormat(d.pop("format"))




        locale = CreatedWebhookLocale(d.pop("locale"))




        enabled = d.pop("enabled")

        def _parse_disabled_reason(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        disabled_reason = _parse_disabled_reason(d.pop("disabledReason"))


        def _parse_failing_since(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                failing_since_type_0 = datetime.datetime.fromisoformat(data)



                return failing_since_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        failing_since = _parse_failing_since(d.pop("failingSince"))


        def _parse_last_delivery(data: object) -> CreatedWebhookLastDeliveryType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                last_delivery_type_0 = CreatedWebhookLastDeliveryType0.from_dict(data)



                return last_delivery_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(CreatedWebhookLastDeliveryType0 | None, data)

        last_delivery = _parse_last_delivery(d.pop("lastDelivery"))


        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))




        secret = d.pop("secret")

        created_webhook = cls(
            id=id,
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
            disabled_reason=disabled_reason,
            failing_since=failing_since,
            last_delivery=last_delivery,
            created_at=created_at,
            secret=secret,
        )

        return created_webhook

