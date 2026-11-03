from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.created_webhook_last_delivery_type_0_status import CreatedWebhookLastDeliveryType0Status
from typing import cast
import datetime






T = TypeVar("T", bound="CreatedWebhookLastDeliveryType0")



@_attrs_define
class CreatedWebhookLastDeliveryType0:
    """ 
        Attributes:
            status (CreatedWebhookLastDeliveryType0Status):
            response_status (int | None):
            at (datetime.datetime):
     """

    status: CreatedWebhookLastDeliveryType0Status
    response_status: int | None
    at: datetime.datetime





    def to_dict(self) -> dict[str, Any]:
        status = self.status.value

        response_status: int | None
        response_status = self.response_status

        at = self.at.isoformat()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "status": status,
            "responseStatus": response_status,
            "at": at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        status = CreatedWebhookLastDeliveryType0Status(d.pop("status"))




        def _parse_response_status(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        response_status = _parse_response_status(d.pop("responseStatus"))


        at = datetime.datetime.fromisoformat(d.pop("at"))




        created_webhook_last_delivery_type_0 = cls(
            status=status,
            response_status=response_status,
            at=at,
        )

        return created_webhook_last_delivery_type_0

