from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.diff_block_type_0 import DiffBlockType0
  from ..models.diff_block_type_1 import DiffBlockType1
  from ..models.page_version_summary import PageVersionSummary





T = TypeVar("T", bound="PageDiff")



@_attrs_define
class PageDiff:
    """ 
        Attributes:
            from_ (PageVersionSummary):
            to (PageVersionSummary):
            blocks (list[DiffBlockType0 | DiffBlockType1]):
     """

    from_: PageVersionSummary
    to: PageVersionSummary
    blocks: list[DiffBlockType0 | DiffBlockType1]





    def to_dict(self) -> dict[str, Any]:
        from ..models.diff_block_type_0 import DiffBlockType0 # noqa: PLC0415
        from ..models.diff_block_type_1 import DiffBlockType1 # noqa: PLC0415
        from ..models.page_version_summary import PageVersionSummary # noqa: PLC0415
        from_ = self.from_.to_dict()

        to = self.to.to_dict()

        blocks = []
        for blocks_item_data in self.blocks:
            blocks_item: dict[str, Any]
            if isinstance(blocks_item_data, DiffBlockType0):
                blocks_item = blocks_item_data.to_dict()
            else:
                blocks_item = blocks_item_data.to_dict()

            blocks.append(blocks_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "from": from_,
            "to": to,
            "blocks": blocks,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.diff_block_type_0 import DiffBlockType0 # noqa: PLC0415
        from ..models.diff_block_type_1 import DiffBlockType1 # noqa: PLC0415
        from ..models.page_version_summary import PageVersionSummary # noqa: PLC0415
        d = dict(src_dict)
        from_ = PageVersionSummary.from_dict(d.pop("from"))




        to = PageVersionSummary.from_dict(d.pop("to"))




        blocks = []
        _blocks = d.pop("blocks")
        for blocks_item_data in (_blocks):
            def _parse_blocks_item(data: object) -> DiffBlockType0 | DiffBlockType1:
                try:
                    if not isinstance(data, dict):
                        raise TypeError()
                    componentsschemas_diff_block_type_0 = DiffBlockType0.from_dict(data)



                    return componentsschemas_diff_block_type_0
                except (TypeError, ValueError, AttributeError, KeyError):
                    pass
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_diff_block_type_1 = DiffBlockType1.from_dict(data)



                return componentsschemas_diff_block_type_1

            blocks_item = _parse_blocks_item(blocks_item_data)

            blocks.append(blocks_item)


        page_diff = cls(
            from_=from_,
            to=to,
            blocks=blocks,
        )

        return page_diff

