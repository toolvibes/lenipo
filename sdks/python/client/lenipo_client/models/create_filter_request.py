from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
  from ..models.filter_share_input_type_0 import FilterShareInputType0
  from ..models.filter_share_input_type_1 import FilterShareInputType1
  from ..models.filter_share_input_type_2 import FilterShareInputType2
  from ..models.filter_share_input_type_3 import FilterShareInputType3





T = TypeVar("T", bound="CreateFilterRequest")



@_attrs_define
class CreateFilterRequest:
    """ 
        Attributes:
            name (str):
            query (str):
            description (str | Unset):  Default: ''.
            shares (list[FilterShareInputType0 | FilterShareInputType1 | FilterShareInputType2 | FilterShareInputType3] |
                Unset):
            favourite (bool | Unset):  Default: True.
     """

    name: str
    query: str
    description: str | Unset = ''
    shares: list[FilterShareInputType0 | FilterShareInputType1 | FilterShareInputType2 | FilterShareInputType3] | Unset = UNSET
    favourite: bool | Unset = True
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.filter_share_input_type_0 import FilterShareInputType0 # noqa: PLC0415
        from ..models.filter_share_input_type_1 import FilterShareInputType1 # noqa: PLC0415
        from ..models.filter_share_input_type_2 import FilterShareInputType2 # noqa: PLC0415
        from ..models.filter_share_input_type_3 import FilterShareInputType3 # noqa: PLC0415
        name = self.name

        query = self.query

        description = self.description

        shares: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.shares, Unset):
            shares = []
            for shares_item_data in self.shares:
                shares_item: dict[str, Any]
                if isinstance(shares_item_data, FilterShareInputType0):
                    shares_item = shares_item_data.to_dict()
                elif isinstance(shares_item_data, FilterShareInputType1):
                    shares_item = shares_item_data.to_dict()
                elif isinstance(shares_item_data, FilterShareInputType2):
                    shares_item = shares_item_data.to_dict()
                else:
                    shares_item = shares_item_data.to_dict()

                shares.append(shares_item)



        favourite = self.favourite


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "name": name,
            "query": query,
        })
        if description is not UNSET:
            field_dict["description"] = description
        if shares is not UNSET:
            field_dict["shares"] = shares
        if favourite is not UNSET:
            field_dict["favourite"] = favourite

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.filter_share_input_type_0 import FilterShareInputType0 # noqa: PLC0415
        from ..models.filter_share_input_type_1 import FilterShareInputType1 # noqa: PLC0415
        from ..models.filter_share_input_type_2 import FilterShareInputType2 # noqa: PLC0415
        from ..models.filter_share_input_type_3 import FilterShareInputType3 # noqa: PLC0415
        d = dict(src_dict)
        name = d.pop("name")

        query = d.pop("query")

        description = d.pop("description", UNSET)

        _shares = d.pop("shares", UNSET)
        shares: list[FilterShareInputType0 | FilterShareInputType1 | FilterShareInputType2 | FilterShareInputType3] | Unset = UNSET
        if _shares is not UNSET:
            shares = []
            for shares_item_data in _shares:
                def _parse_shares_item(data: object) -> FilterShareInputType0 | FilterShareInputType1 | FilterShareInputType2 | FilterShareInputType3:
                    try:
                        if not isinstance(data, dict):
                            raise TypeError()
                        componentsschemas_filter_share_input_type_0 = FilterShareInputType0.from_dict(data)



                        return componentsschemas_filter_share_input_type_0
                    except (TypeError, ValueError, AttributeError, KeyError):
                        pass
                    try:
                        if not isinstance(data, dict):
                            raise TypeError()
                        componentsschemas_filter_share_input_type_1 = FilterShareInputType1.from_dict(data)



                        return componentsschemas_filter_share_input_type_1
                    except (TypeError, ValueError, AttributeError, KeyError):
                        pass
                    try:
                        if not isinstance(data, dict):
                            raise TypeError()
                        componentsschemas_filter_share_input_type_2 = FilterShareInputType2.from_dict(data)



                        return componentsschemas_filter_share_input_type_2
                    except (TypeError, ValueError, AttributeError, KeyError):
                        pass
                    if not isinstance(data, dict):
                        raise TypeError()
                    componentsschemas_filter_share_input_type_3 = FilterShareInputType3.from_dict(data)



                    return componentsschemas_filter_share_input_type_3

                shares_item = _parse_shares_item(shares_item_data)

                shares.append(shares_item)


        favourite = d.pop("favourite", UNSET)

        create_filter_request = cls(
            name=name,
            query=query,
            description=description,
            shares=shares,
            favourite=favourite,
        )


        create_filter_request.additional_properties = d
        return create_filter_request

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
