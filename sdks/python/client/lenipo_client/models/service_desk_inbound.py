from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="ServiceDeskInbound")



@_attrs_define
class ServiceDeskInbound:
    """ 
        Attributes:
            path (str):
            enabled (bool):
            token_created_at (datetime.datetime | None):
     """

    path: str
    enabled: bool
    token_created_at: datetime.datetime | None





    def to_dict(self) -> dict[str, Any]:
        path = self.path

        enabled = self.enabled

        token_created_at: None | str
        if isinstance(self.token_created_at, datetime.datetime):
            token_created_at = self.token_created_at.isoformat()
        else:
            token_created_at = self.token_created_at


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "path": path,
            "enabled": enabled,
            "tokenCreatedAt": token_created_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        path = d.pop("path")

        enabled = d.pop("enabled")

        def _parse_token_created_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                token_created_at_type_0 = datetime.datetime.fromisoformat(data)



                return token_created_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        token_created_at = _parse_token_created_at(d.pop("tokenCreatedAt"))


        service_desk_inbound = cls(
            path=path,
            enabled=enabled,
            token_created_at=token_created_at,
        )

        return service_desk_inbound

