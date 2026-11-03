from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="AddServiceCustomerRequestType0")



@_attrs_define
class AddServiceCustomerRequestType0:
    """ 
        Attributes:
            user_id (UUID):
     """

    user_id: UUID





    def to_dict(self) -> dict[str, Any]:
        user_id = str(self.user_id)


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "userId": user_id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        user_id = UUID(d.pop("userId"))




        add_service_customer_request_type_0 = cls(
            user_id=user_id,
        )

        return add_service_customer_request_type_0

