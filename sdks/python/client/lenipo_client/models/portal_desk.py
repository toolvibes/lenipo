from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.request_type import RequestType





T = TypeVar("T", bound="PortalDesk")



@_attrs_define
class PortalDesk:
    """ 
        Attributes:
            key (str):
            name (str):
            intro (str):
            request_types (list[RequestType]):
     """

    key: str
    name: str
    intro: str
    request_types: list[RequestType]





    def to_dict(self) -> dict[str, Any]:
        from ..models.request_type import RequestType # noqa: PLC0415
        key = self.key

        name = self.name

        intro = self.intro

        request_types = []
        for request_types_item_data in self.request_types:
            request_types_item = request_types_item_data.to_dict()
            request_types.append(request_types_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "key": key,
            "name": name,
            "intro": intro,
            "requestTypes": request_types,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.request_type import RequestType # noqa: PLC0415
        d = dict(src_dict)
        key = d.pop("key")

        name = d.pop("name")

        intro = d.pop("intro")

        request_types = []
        _request_types = d.pop("requestTypes")
        for request_types_item_data in (_request_types):
            request_types_item = RequestType.from_dict(request_types_item_data)



            request_types.append(request_types_item)


        portal_desk = cls(
            key=key,
            name=name,
            intro=intro,
            request_types=request_types,
        )

        return portal_desk

