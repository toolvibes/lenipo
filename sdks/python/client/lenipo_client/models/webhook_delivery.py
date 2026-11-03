from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.webhook_delivery_status import WebhookDeliveryStatus
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="WebhookDelivery")



@_attrs_define
class WebhookDelivery:
    """ 
        Attributes:
            id (UUID):
            type_ (str):
            status (WebhookDeliveryStatus):
            attempts (int):
            next_attempt_at (datetime.datetime | None):
            last_attempt_at (datetime.datetime | None):
            response_status (int | None):
            response_body (None | str):
            duration_ms (int | None):
            created_at (datetime.datetime):
     """

    id: UUID
    type_: str
    status: WebhookDeliveryStatus
    attempts: int
    next_attempt_at: datetime.datetime | None
    last_attempt_at: datetime.datetime | None
    response_status: int | None
    response_body: None | str
    duration_ms: int | None
    created_at: datetime.datetime





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        type_ = self.type_

        status = self.status.value

        attempts = self.attempts

        next_attempt_at: None | str
        if isinstance(self.next_attempt_at, datetime.datetime):
            next_attempt_at = self.next_attempt_at.isoformat()
        else:
            next_attempt_at = self.next_attempt_at

        last_attempt_at: None | str
        if isinstance(self.last_attempt_at, datetime.datetime):
            last_attempt_at = self.last_attempt_at.isoformat()
        else:
            last_attempt_at = self.last_attempt_at

        response_status: int | None
        response_status = self.response_status

        response_body: None | str
        response_body = self.response_body

        duration_ms: int | None
        duration_ms = self.duration_ms

        created_at = self.created_at.isoformat()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "type": type_,
            "status": status,
            "attempts": attempts,
            "nextAttemptAt": next_attempt_at,
            "lastAttemptAt": last_attempt_at,
            "responseStatus": response_status,
            "responseBody": response_body,
            "durationMs": duration_ms,
            "createdAt": created_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        type_ = d.pop("type")

        status = WebhookDeliveryStatus(d.pop("status"))




        attempts = d.pop("attempts")

        def _parse_next_attempt_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                next_attempt_at_type_0 = datetime.datetime.fromisoformat(data)



                return next_attempt_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        next_attempt_at = _parse_next_attempt_at(d.pop("nextAttemptAt"))


        def _parse_last_attempt_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_attempt_at_type_0 = datetime.datetime.fromisoformat(data)



                return last_attempt_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        last_attempt_at = _parse_last_attempt_at(d.pop("lastAttemptAt"))


        def _parse_response_status(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        response_status = _parse_response_status(d.pop("responseStatus"))


        def _parse_response_body(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        response_body = _parse_response_body(d.pop("responseBody"))


        def _parse_duration_ms(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        duration_ms = _parse_duration_ms(d.pop("durationMs"))


        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))




        webhook_delivery = cls(
            id=id,
            type_=type_,
            status=status,
            attempts=attempts,
            next_attempt_at=next_attempt_at,
            last_attempt_at=last_attempt_at,
            response_status=response_status,
            response_body=response_body,
            duration_ms=duration_ms,
            created_at=created_at,
        )

        return webhook_delivery

